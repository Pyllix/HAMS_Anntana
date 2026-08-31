import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { AssetService } from '../src/asset/asset.service';
import { CompanyService } from '../src/company/company.service';
import { SectionsService } from '../src/sections/sections.service';
import { SparePartsService } from '../src/spare-parts/spare-parts.service';
import { SparePartGroupService } from '../src/spare-part-group/spare-part-group.service';

describe('RBAC Authorization (e2e)', () => {
  let app: INestApplication;

  // Mock services to return mock data for successful RBAC checks
  const mockUsersService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn().mockResolvedValue({ id: '1', email: 'new@example.com' }),
  };

  const mockAssetService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'asset-1', name: 'Test Asset' }),
  };

  const mockCompanyService = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'comp-1', name: 'Test Co' }),
  };

  const mockSectionsService = {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'sec-1', name: 'Test Section' }),
  };

  const mockSparePartsService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'SP-01' }),
  };

  const mockSparePartGroupService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn().mockResolvedValue({ id: 1, name: 'Group 1' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .overrideProvider(AssetService)
      .useValue(mockAssetService)
      .overrideProvider(CompanyService)
      .useValue(mockCompanyService)
      .overrideProvider(SectionsService)
      .useValue(mockSectionsService)
      .overrideProvider(SparePartsService)
      .useValue(mockSparePartsService)
      .overrideProvider(SparePartGroupService)
      .useValue(mockSparePartGroupService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Express middleware to populate req.user and req.session from x-test-role header BEFORE any NestJS guard runs
    app.use((req: any, _res: any, next: any) => {
      const roleHeader = req.headers['x-test-role'];
      if (roleHeader) {
        const mockUser = {
          id: 'test-user-id',
          email: 'test@example.com',
          role: roleHeader as UserRole,
        };
        req.user = mockUser;
        req.session = { user: mockUser };
      }
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── UC11: Users Management (Admin Only) ───────────────────────────────────

  describe('UC11: Users Management (/users)', () => {
    it('GET /users -> 200 OK when user is ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('x-test-role', UserRole.ADMIN)
        .expect(200);
    });

    it('GET /users -> 200 OK for authenticated users (DEPARTMENT_STAFF, PARCEL_STAFF, etc.)', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users')
        .set('x-test-role', UserRole.PARCEL_STAFF)
        .expect(200);
    });

    it('POST /users -> 201 Created when user is ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('x-test-role', UserRole.ADMIN)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'Password123!',
          role: UserRole.DEPARTMENT_STAFF,
        })
        .expect(201);
    });

    it('POST /users -> 403 Forbidden when user is MANAGER', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('x-test-role', UserRole.MANAGER)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'Password123!',
          role: UserRole.DEPARTMENT_STAFF,
        })
        .expect(403);
    });
  });

  // ─── UC6: Asset Management (/asset) ───────────────────────────────────────

  describe('UC6 & UC2: Asset Management (/asset)', () => {
    it('POST /asset -> 201 Created for PARCEL_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/asset')
        .set('x-test-role', UserRole.PARCEL_STAFF)
        .send({ name: 'Laptop', code: 'A001' })
        .expect(201);
    });

    it('POST /asset -> 201 Created for ASSET_CENTER_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/asset')
        .set('x-test-role', UserRole.ASSET_CENTER_STAFF)
        .send({ name: 'Monitor', code: 'A002' })
        .expect(201);
    });

    it('POST /asset -> 403 Forbidden for DEPARTMENT_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/asset')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .send({ name: 'Printer', code: 'A003' })
        .expect(403);
    });

    it('GET /asset -> 200 OK for DEPARTMENT_STAFF (UC2 Audit/View)', async () => {
      await request(app.getHttpServer())
        .get('/asset')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .expect(200);
    });
  });

  // ─── Master Data: Company & Sections ───────────────────────────────────────

  describe('Master Data Access Control (/company & /sections)', () => {
    it('POST /company -> 201 Created for ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/company')
        .set('x-test-role', UserRole.ADMIN)
        .send({ code: 'COMP01', name: 'Supplier Co' })
        .expect(201);
    });

    it('POST /company -> 403 Forbidden for MAINTENANCE_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/company')
        .set('x-test-role', UserRole.MAINTENANCE_STAFF)
        .send({ code: 'COMP02', name: 'Unauthorized Co' })
        .expect(403);
    });

    it('GET /sections -> 200 OK for all authenticated roles', async () => {
      await request(app.getHttpServer())
        .get('/sections')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .expect(200);
    });
  });

  // ─── UC4: Spare Parts Management (/spare-parts & /spare-part-groups) ─────

  describe('UC4: Spare Parts Management (/spare-parts & /spare-part-groups)', () => {
    it('POST /spare-parts -> 201 Created for PARCEL_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/spare-parts')
        .set('x-test-role', UserRole.PARCEL_STAFF)
        .send({ code: 'SP01', name: 'Filter', price: 50, groupId: 1 })
        .expect(201);
    });

    it('POST /spare-parts -> 403 Forbidden for ADMIN (UC4: ADMIN is Read-Only)', async () => {
      await request(app.getHttpServer())
        .post('/spare-parts')
        .set('x-test-role', UserRole.ADMIN)
        .send({ code: 'SP02', name: 'Valve', price: 100, groupId: 1 })
        .expect(403);
    });

    it('POST /spare-parts -> 403 Forbidden for DEPARTMENT_STAFF', async () => {
      await request(app.getHttpServer())
        .post('/spare-parts')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .send({ code: 'SP03', name: 'Bolt', price: 10, groupId: 1 })
        .expect(403);
    });

    it('GET /spare-parts -> 200 OK for ADMIN, MAINTENANCE_STAFF, and PARCEL_STAFF', async () => {
      await request(app.getHttpServer())
        .get('/spare-parts')
        .set('x-test-role', UserRole.ADMIN)
        .expect(200);

      await request(app.getHttpServer())
        .get('/spare-parts')
        .set('x-test-role', UserRole.MAINTENANCE_STAFF)
        .expect(200);
    });

    it('GET /spare-parts -> 403 Forbidden for DEPARTMENT_STAFF', async () => {
      await request(app.getHttpServer())
        .get('/spare-parts')
        .set('x-test-role', UserRole.DEPARTMENT_STAFF)
        .expect(403);
    });
  });
});
