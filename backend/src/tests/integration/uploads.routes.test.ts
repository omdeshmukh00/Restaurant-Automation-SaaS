jest.mock('express-rate-limit', () => {
  return jest.fn().mockReturnValue((req: any, res: any, next: any) => next());
});
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

import request from 'supertest';
import app from '../../app';
import { env } from '../../config/env';
import { UserRole } from '../../constants/roles';
import { signAccessToken } from '../../services/jwt.service';
import { RestaurantModel } from '../../modules/restaurants/restaurants.model';
import { UploadModel } from '../../modules/uploads/uploads.model';
import { AuditLogModel } from '../../modules/auditLogs/auditLogs.schema';
import { AuditAction, AuditEntity } from '../../modules/auditLogs/auditLogs.types';

function createToken(restaurantId: string, role: UserRole = UserRole.RESTAURANT_ADMIN): string {
  return signAccessToken({
    _id: '507f1f77bcf86cd799439011',
    email: `${role}@example.com`,
    role,
    restaurantId,
  });
}

async function createTenant(slug: string) {
  const restaurant = await RestaurantModel.create({
    slug,
    name: slug,
    plan: 'PRO',
    cuisine: 'Indian',
    city: 'Delhi',
  });

  return {
    restaurant,
    token: createToken(restaurant.id),
    staffToken: createToken(restaurant.id, UserRole.SERVICE_STAFF),
  };
}

function filePayload(content: string, fileName = 'document.pdf', mimeType = 'application/pdf') {
  return {
    fileName,
    mimeType,
    content: Buffer.from(content).toString('base64'),
  };
}

describe('Upload Routes', () => {
  beforeEach(() => {
    env.UPLOAD_PROVIDER = 'local';
    env.MAX_IMAGE_SIZE_MB = 5;
    env.MAX_DOCUMENT_SIZE_MB = 10;
  });

  describe('Validation', () => {
    it('uploads a valid pdf', async () => {
      const { token } = await createTenant('valid-pdf');
      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('pdf content', 'test.pdf', 'application/pdf'));

      expect(res.status).toBe(201);
    });

    it('uploads a valid image', async () => {
      const { token } = await createTenant('valid-img');
      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('img content', 'test.png', 'image/png'));

      expect(res.status).toBe(201);
    });

    it('rejects invalid file extension', async () => {
      const { token } = await createTenant('invalid-ext');
      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('exe content', 'malicious.exe', 'application/pdf'));

      expect(res.status).toBe(400);
    });

    it('rejects invalid mime type', async () => {
      const { token } = await createTenant('invalid-mime');
      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('txt content', 'test.pdf', 'text/plain'));

      expect(res.status).toBe(400);
    });

    it('rejects oversized file based on type limits', async () => {
      const { token } = await createTenant('oversized');
      env.MAX_IMAGE_SIZE_MB = 0; // force limit
      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('img content', 'test.png', 'image/png'));

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('File exceeds 0MB limit');
    });
  });

  describe('Tenant Isolation', () => {
    it('enforces tenant isolation', async () => {
      const tenantA = await createTenant('tenant-a');
      const tenantB = await createTenant('tenant-b');

      const uploadResponse = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${tenantA.token}`)
        .send(filePayload('tenant a secret'));

      const crossTenantDownload = await request(app)
        .get(`/api/v1/uploads/${uploadResponse.body.data._id}/download`)
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(crossTenantDownload.status).toBe(404);
    });
  });

  describe('RBAC', () => {
    it('rejects unauthorized upload requests', async () => {
      const response = await request(app)
        .post('/api/v1/uploads')
        .send(filePayload('no auth'));

      expect(response.status).toBe(401);
    });

    it('allows admin to delete uploads', async () => {
      const { token } = await createTenant('admin-delete');

      const uploadResponse = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('delete me'));

      const deleteResponse = await request(app)
        .delete(`/api/v1/uploads/${uploadResponse.body.data._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteResponse.status).toBe(200);
      expect(await UploadModel.findById(uploadResponse.body.data._id)).toBeNull();
    });

    it('prevents staff from deleting uploads', async () => {
      const { token, staffToken } = await createTenant('staff-delete');

      const uploadResponse = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('delete me'));

      const deleteResponse = await request(app)
        .delete(`/api/v1/uploads/${uploadResponse.body.data._id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(deleteResponse.status).toBe(403);
    });
  });

  describe('Audit Logging', () => {
    it('creates an audit log on upload and delete', async () => {
      const { token, restaurant } = await createTenant('audit-flow');

      // Upload
      const uploadResponse = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('audit me'));

      expect(uploadResponse.status).toBe(201);
      const uploadId = uploadResponse.body.data._id;

      let logs = await AuditLogModel.find({ entityType: AuditEntity.UPLOAD, entityId: uploadId });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe(AuditAction.UPLOAD_CREATED);
      expect(logs[0].restaurantId?.toString()).toBe(restaurant.id);

      // Delete
      await request(app)
        .delete(`/api/v1/uploads/${uploadId}`)
        .set('Authorization', `Bearer ${token}`);

      logs = await AuditLogModel.find({ entityType: AuditEntity.UPLOAD, entityId: uploadId, action: AuditAction.UPLOAD_DELETED });
      expect(logs.length).toBe(1);
    });
  });

  describe('Other Flows', () => {
    it('replaces upload content and metadata', async () => {
      const { token } = await createTenant('replacement-flow');

      const uploadResponse = await request(app)
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('old file', 'old.pdf'));

      const replaceResponse = await request(app)
        .patch(`/api/v1/uploads/${uploadResponse.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(filePayload('new file', 'new.pdf'));

      expect(replaceResponse.status).toBe(200);
      expect(replaceResponse.body.data.fileName).toBe('new.pdf');
    });
  });
});
