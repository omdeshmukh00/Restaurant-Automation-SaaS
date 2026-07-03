import request from 'supertest';
import app from '../../app';
import { env } from '../../config/env';
import { UserRole } from '../../constants/roles';
import { signAccessToken } from '../../services/jwt.service';
import { RestaurantModel } from '../../modules/restaurants/restaurants.model';
import { UploadModel } from '../../modules/uploads/uploads.model';

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
  };
}

function filePayload(content: string, fileName = 'document.txt') {
  return {
    fileName,
    mimeType: 'text/plain',
    content: Buffer.from(content).toString('base64'),
  };
}

describe('Upload Routes', () => {
  beforeEach(() => {
    env.UPLOAD_PROVIDER = 'local';
  });

  it('enforces tenant isolation', async () => {
    const tenantA = await createTenant('tenant-a');
    const tenantB = await createTenant('tenant-b');

    const uploadResponse = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send(filePayload('tenant a secret'));

    expect(uploadResponse.status).toBe(201);

    const crossTenantDownload = await request(app)
      .get(`/api/v1/uploads/${uploadResponse.body.data._id}/download`)
      .set('Authorization', `Bearer ${tenantB.token}`);

    expect(crossTenantDownload.status).toBe(404);
  });

  it('rejects unauthorized upload requests', async () => {
    const response = await request(app)
      .post('/api/v1/uploads')
      .send(filePayload('no auth'));

    expect(response.status).toBe(401);
  });

  it('deletes uploads within the authenticated tenant', async () => {
    const { token } = await createTenant('delete-flow');

    const uploadResponse = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send(filePayload('delete me'));

    expect(uploadResponse.status).toBe(201);

    const deleteResponse = await request(app)
      .delete(`/api/v1/uploads/${uploadResponse.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(await UploadModel.findById(uploadResponse.body.data._id)).toBeNull();
  });

  it('replaces upload content and metadata', async () => {
    const { token } = await createTenant('replacement-flow');

    const uploadResponse = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send(filePayload('old file', 'old.txt'));

    const replaceResponse = await request(app)
      .patch(`/api/v1/uploads/${uploadResponse.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(filePayload('new file', 'new.txt'));

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body.data.fileName).toBe('new.txt');
    expect(replaceResponse.body.data.size).toBe(Buffer.byteLength('new file'));

    const downloadResponse = await request(app)
      .get(`/api/v1/uploads/${uploadResponse.body.data._id}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.text).toBe('new file');
  });

  it('serves documents only through authenticated download endpoint', async () => {
    const { token } = await createTenant('secure-download');

    const uploadResponse = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send(filePayload('download me'));

    const unauthenticatedDownload = await request(app)
      .get(`/api/v1/uploads/${uploadResponse.body.data._id}/download`);

    expect(unauthenticatedDownload.status).toBe(401);

    const authenticatedDownload = await request(app)
      .get(`/api/v1/uploads/${uploadResponse.body.data._id}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(authenticatedDownload.status).toBe(200);
    expect(authenticatedDownload.text).toBe('download me');
    expect(uploadResponse.body.data.storageKey).toContain('tenants/');
    expect(uploadResponse.body.data.storageKey).not.toMatch(/^uploads\//);
  });
});
