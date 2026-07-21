import crypto from 'crypto';
import fs from 'fs/promises';
import https from 'https';
import path from 'path';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { ErrorCode } from '../../constants/errors';
import { AppError } from '../../utils/AppError';
import { IUpload, UploadModel } from './uploads.model';
import { ALLOWED_IMAGE_MIMES } from './uploads.schema';

type FileInput = {
  fileName: string;
  mimeType: string;
  content: string;
};

type StoredFile = {
  provider: 'local' | 's3';
  storageKey: string;
  size: number;
  checksum: string;
};

type DownloadedFile = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

const privateUploadRoot = path.resolve(process.cwd(), 'storage', 'private-uploads');

function decodeContent(content: string): Buffer {
  const buffer = Buffer.from(content, 'base64');
  if (!buffer.length) {
    throw new AppError('File content is required', 400, ErrorCode.INVALID_REQUEST);
  }
  return buffer;
}

function sanitizeFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^\w.\- ]+/g, '_');
}

function buildStorageKey(tenantId: string, fileName: string): string {
  const ext = path.extname(fileName);
  return `tenants/${tenantId}/uploads/${crypto.randomUUID()}${ext}`;
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function awsDate(now = new Date()): { dateStamp: string; amzDate: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    dateStamp: iso.slice(0, 8),
    amzDate: iso,
  };
}

function s3Config() {
  if (!env.AWS_REGION || !env.AWS_S3_BUCKET || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new AppError('S3 upload provider is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
  }

  return {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    endpoint: env.AWS_S3_ENDPOINT,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  };
}

function s3Request(method: 'PUT' | 'GET' | 'DELETE', key: string, body?: Buffer, contentType?: string): Promise<Buffer> {
  const config = s3Config();
  const endpoint = config.endpoint ? new URL(config.endpoint) : undefined;
  const host = endpoint?.host ?? `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const pathname = endpoint && config.forcePathStyle
    ? `/${config.bucket}/${key}`
    : `/${key}`;
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const { dateStamp, amzDate } = awsDate();

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((header) => `${header}:${headers[header]}\n`)
    .join('');
  const canonicalRequest = [
    method,
    pathname.split('/').map(encodeURIComponent).join('/'),
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', getSigningKey(config.secretAccessKey, dateStamp, config.region, 's3'))
    .update(stringToSign)
    .digest('hex');

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method,
        hostname: host,
        path: pathname,
        headers: {
          ...headers,
          ...(body ? { 'content-length': body.length } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(responseBody);
            return;
          }
          reject(new AppError('S3 request failed', 502, ErrorCode.SERVICE_UNAVAILABLE));
        });
      },
    );

    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function storeLocal(storageKey: string, buffer: Buffer): Promise<void> {
  const target = path.resolve(privateUploadRoot, storageKey);
  if (!target.startsWith(privateUploadRoot)) {
    throw new AppError('Invalid upload path', 400, ErrorCode.INVALID_REQUEST);
  }
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new AppError('Permission denied when writing file', 500, ErrorCode.INTERNAL_ERROR);
    }
    if (err.code === 'EEXIST') {
      throw new AppError('File already exists', 409, ErrorCode.INVALID_REQUEST);
    }
    throw err;
  }
}

async function deleteLocal(storageKey: string): Promise<void> {
  const target = path.resolve(privateUploadRoot, storageKey);
  if (!target.startsWith(privateUploadRoot)) return;
  await fs.rm(target, { force: true });
}

async function readLocal(storageKey: string): Promise<Buffer> {
  const target = path.resolve(privateUploadRoot, storageKey);
  if (!target.startsWith(privateUploadRoot)) {
    throw new AppError('Invalid upload path', 400, ErrorCode.INVALID_REQUEST);
  }
  try {
    return await fs.readFile(target);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new AppError('File not found on disk', 404, ErrorCode.NOT_FOUND);
    }
    throw err;
  }
}

async function storeFile(tenantId: string, input: FileInput): Promise<StoredFile> {
  const buffer = decodeContent(input.content);
  
  // Validate maximum payload size based on type
  const isImage = ALLOWED_IMAGE_MIMES.includes(input.mimeType);
  const maxMb = isImage ? env.MAX_IMAGE_SIZE_MB : env.MAX_DOCUMENT_SIZE_MB;
  const maxBytes = maxMb * 1024 * 1024;
  
  if (buffer.length > maxBytes) {
    throw new AppError(`File exceeds ${maxMb}MB limit`, 400, ErrorCode.INVALID_REQUEST);
  }

  const storageKey = buildStorageKey(tenantId, input.fileName);
  const checksum = sha256(buffer);
  if (env.UPLOAD_PROVIDER === 's3') {
    await s3Request('PUT', storageKey, buffer, input.mimeType);
    return { provider: 's3', storageKey, size: buffer.length, checksum };
  }

  await storeLocal(storageKey, buffer);
  return { provider: 'local', storageKey, size: buffer.length, checksum };
}

async function removeStoredFile(upload: IUpload): Promise<void> {
  if (upload.provider === 's3') {
    await s3Request('DELETE', upload.storageKey);
    return;
  }
  await deleteLocal(upload.storageKey);
}

export class UploadService {
  static async create(tenantId: string, userId: string, input: FileInput): Promise<IUpload> {
    const stored = await storeFile(tenantId, input);
    return UploadModel.create({
      tenantId,
      originalName: input.fileName,
      fileName: sanitizeFileName(input.fileName),
      mimeType: input.mimeType,
      uploadedBy: userId,
      ...stored,
    });
  }

  static async list(tenantId: string): Promise<IUpload[]> {
    return UploadModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, uploadId: string): Promise<IUpload> {
    const upload = await UploadModel.findOne({ _id: uploadId, tenantId });
    if (!upload) {
      throw new AppError('Upload not found', 404, ErrorCode.NOT_FOUND);
    }
    return upload;
  }

  static async replace(tenantId: string, uploadId: string, input: FileInput): Promise<IUpload> {
    const upload = await this.getById(tenantId, uploadId);
    const previousStorage = upload.toObject();
    const stored = await storeFile(tenantId, input);

    upload.originalName = input.fileName;
    upload.fileName = sanitizeFileName(input.fileName);
    upload.mimeType = input.mimeType;
    upload.provider = stored.provider;
    upload.storageKey = stored.storageKey;
    upload.size = stored.size;
    upload.checksum = stored.checksum;
    await upload.save();

    await removeStoredFile(previousStorage as IUpload);
    return upload;
  }

  static async delete(tenantId: string, uploadId: string): Promise<void> {
    const upload = await UploadModel.findOneAndDelete({ _id: uploadId, tenantId });
    if (!upload) {
      throw new AppError('Upload not found', 404, ErrorCode.NOT_FOUND);
    }
    await removeStoredFile(upload);
  }

  static async download(tenantId: string, uploadId: string): Promise<DownloadedFile> {
    const upload = await this.getById(tenantId, uploadId);
    const buffer = upload.provider === 's3'
      ? await s3Request('GET', upload.storageKey)
      : await readLocal(upload.storageKey);

    return {
      buffer,
      mimeType: upload.mimeType,
      fileName: upload.fileName,
    };
  }

  static async getByIdPublic(uploadId: string): Promise<IUpload> {
    if (!Types.ObjectId.isValid(uploadId)) {
      throw new AppError('Upload not found', 404, ErrorCode.NOT_FOUND);
    }
    const upload = await UploadModel.findOne({ _id: uploadId });
    if (!upload) {
      throw new AppError('Upload not found', 404, ErrorCode.NOT_FOUND);
    }
    return upload;
  }

  static async downloadPublic(uploadId: string): Promise<DownloadedFile> {
    const upload = await this.getByIdPublic(uploadId);
    if (!(upload.mimeType ?? '').startsWith('image/')) {
      throw new AppError('Upload not found', 404, ErrorCode.NOT_FOUND);
    }
    const buffer = upload.provider === 's3'
      ? await s3Request('GET', upload.storageKey)
      : await readLocal(upload.storageKey);

    return {
      buffer,
      mimeType: upload.mimeType,
      fileName: upload.fileName,
    };
  }

  static normalizeTenantId(tenantId: string): string {
    if (!Types.ObjectId.isValid(tenantId)) {
      throw new AppError('Tenant ID is required', 400, ErrorCode.INVALID_REQUEST);
    }
    return tenantId;
  }
}
