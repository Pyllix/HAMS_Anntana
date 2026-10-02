import {
  ImageReadService,
  employeePhotoReadGrantWindowMs,
} from './image-read.service';
import type { PrismaService } from '../prisma.service';
import type { ImageStoragePort } from './image-storage.port';

const now = new Date('2026-10-03T03:00:00.000Z');
const photo = {
  imageUrl: null,
  imageStorageProvider: 'cloudinary',
  imageStorageAccountId: 'test-cloud',
  imagePublicId: 'hams-employee-photo-test-upload',
  imageResourceType: 'image',
  imageDeliveryType: 'authenticated',
  imageVersion: 17,
};

describe('ImageReadService', () => {
  let service: ImageReadService;
  let findFirst: jest.Mock;
  let createShortLivedReadGrant: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn();
    createShortLivedReadGrant = jest.fn((_reference, expiresAt: Date) => ({
      url: `https://api.cloudinary.com/v1_1/test-cloud/image/download?public_id=hams-employee-photo-test-upload&type=authenticated&format=jpg&expires_at=${Math.floor(expiresAt.getTime() / 1000)}&signature=opaque-test-grant`,
      expiresAt,
    }));
    service = new ImageReadService(
      { user: { findFirst } } as unknown as PrismaService,
      {
        getProviderContext: jest.fn(() => ({
          provider: 'cloudinary',
          accountId: 'test-cloud',
        })),
        createShortLivedReadGrant,
        publicUrl: jest.fn(
          () =>
            'https://res.cloudinary.com/test-cloud/image/upload/v17/hams-asset-image-test.jpg',
        ),
      } as unknown as ImageStoragePort,
      { now: () => now },
    );
  });

  it('returns an explicit no-photo result without issuing a grant', async () => {
    findFirst.mockResolvedValue({
      imageUrl: null,
      imageStorageProvider: null,
      imageStorageAccountId: null,
      imagePublicId: null,
      imageResourceType: null,
      imageDeliveryType: null,
      imageVersion: null,
    });

    await expect(service.readEmployeePhoto('GOV-260001')).resolves.toEqual({
      hasEmployeePhoto: false,
      photoRevision: null,
      url: null,
      expiresAt: null,
    });
    expect(createShortLivedReadGrant).not.toHaveBeenCalled();
  });

  it('issues an expiring grant for the current photo and returns its revision', async () => {
    findFirst.mockResolvedValue(photo);

    const result = await service.readEmployeePhoto('GOV-260001');

    expect(result.hasEmployeePhoto).toBe(true);
    expect(typeof result.photoRevision).toBe('string');
    expect(result.url).toContain('/image/download?');
    expect(result.expiresAt).toBe('2026-10-03T03:05:00.000Z');
    expect(createShortLivedReadGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: photo.imagePublicId,
        deliveryType: 'authenticated',
        version: photo.imageVersion,
      }),
      new Date('2026-10-03T03:05:00.000Z'),
    );
  });

  it('fails closed when the provider returns a permanent delivery URL', async () => {
    findFirst.mockResolvedValue(photo);
    createShortLivedReadGrant.mockImplementationOnce(
      (_reference: unknown, expiresAt: Date) => ({
        url: 'https://res.cloudinary.com/test-cloud/image/authenticated/v17/hams-employee-photo-test-upload.jpg?signature=permanent',
        expiresAt,
      }),
    );

    await expect(service.readEmployeePhoto('user-id')).rejects.toThrow(
      'The image is temporarily unavailable',
    );
  });

  it('projects user metadata without provider locators or a durable URL', () => {
    const projected = service.projectUser({
      id: 'user-id',
      email: 'employee@example.test',
      ...photo,
    });

    expect(projected).toMatchObject({
      id: 'user-id',
      email: 'employee@example.test',
      imageUrl: null,
      hasEmployeePhoto: true,
    });
    expect(typeof projected.photoRevision).toBe('string');
    for (const field of [
      'imageStorageProvider',
      'imageStorageAccountId',
      'imagePublicId',
      'imageResourceType',
      'imageDeliveryType',
      'imageVersion',
    ]) {
      expect(projected).not.toHaveProperty(field);
    }
  });

  it('uses a five-minute default and allows a bounded configured grant window', () => {
    const original = process.env.IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS;
    delete process.env.IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS;
    expect(employeePhotoReadGrantWindowMs()).toBe(5 * 60 * 1000);

    process.env.IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS = '45';
    expect(employeePhotoReadGrantWindowMs()).toBe(45 * 1000);

    if (original === undefined) {
      delete process.env.IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS;
    } else {
      process.env.IMAGE_EMPLOYEE_PHOTO_READ_GRANT_SECONDS = original;
    }
  });
});
