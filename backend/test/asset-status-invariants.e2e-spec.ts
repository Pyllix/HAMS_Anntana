import 'dotenv/config';
import { randomUUID } from 'crypto';
import type { Server } from 'http';
import type { NextFunction, Request, Response } from 'express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, ReportType, UrgencyStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AssetController } from '../src/asset/asset.controller';
import { AssetService } from '../src/asset/asset.service';
import { RepairsController } from '../src/repairs/repairs.controller';
import { RepairsService } from '../src/repairs/repairs.service';
import { PrismaService } from '../src/prisma.service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase(
  'Cross-module asset status invariants (HTTP + PostgreSQL)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let userId: string;
    let sectionId: string;
    let targetSectionId: string;
    let companyId: string;
    let assetTypeId: number;
    let jobTypeId: number;
    let assetId: string;
    let normalId: number;
    let damagedId: number;
    let underRepairId: number;
    let availableId: number;
    let borrowedId: number;
    let reservedId: number;
    let unavailableId: number;
    let lostId: number;
    let borrowedTransactionStatusId: number;
    let cancelledBorrowStatusId: number;

    type AssetResponse = {
      name: string;
      status: { code: string };
      availabilityStatus: { code: string };
      currentBorrowing: { id: string };
      section: { id: string };
    };
    const server = () => app.getHttpServer() as Server;
    const getAsset = async (): Promise<{ body: AssetResponse }> => {
      const response = await request(server())
        .get(`/asset/${assetId}`)
        .expect(200);
      return { body: response.body as AssetResponse };
    };
    const repairDto = () => ({
      assetId,
      symptom: 'เครื่องเปิดไม่ติด',
      urgencyStatus: UrgencyStatus.NORMAL,
      reportType: ReportType.Repair,
    });
    const transferDto = () => ({
      to_section_id: targetSectionId,
      transferDocNo: `TF-${randomUUID()}`,
      transferDate: '2026-09-23T00:00:00.000Z',
    });
    const disposalDto = () => ({
      disposalDocNo: `DSP-${randomUUID()}`,
      approvedDate: '2026-09-23T00:00:00.000Z',
    });

    async function setState(statusId: number, availabilityId: number) {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          asset_status_id: statusId,
          availability_status_id: availabilityId,
        },
      });
    }

    async function addBorrow() {
      return prisma.borrowTransaction.create({
        data: {
          borrowNo: `BR-${randomUUID()}`,
          asset_id: assetId,
          borrower_id: userId,
          borrow_status_id: borrowedTransactionStatusId,
        },
      });
    }

    beforeAll(async () => {
      if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
        throw new Error(
          'TEST_DATABASE_URL must name a dedicated test database',
        );
      }
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
      });
      await prisma.$connect();

      const assetStatus = async (code: string) =>
        prisma.assetStatus.upsert({
          where: { code },
          create: { code, name: code },
          update: { name: code },
        });
      const availabilityStatus = async (code: string) =>
        prisma.availabilityStatus.upsert({
          where: { code },
          create: { code, name: code },
          update: { name: code },
        });
      normalId = (await assetStatus('NORMAL')).id;
      damagedId = (await assetStatus('DAMAGED')).id;
      underRepairId = (await assetStatus('UNDER_REPAIR')).id;
      lostId = (await assetStatus('LOST')).id;
      await assetStatus('WAIT_DISPOSAL');
      await assetStatus('DISPOSAL');
      availableId = (await availabilityStatus('AVAILABLE')).id;
      borrowedId = (await availabilityStatus('BORROWED')).id;
      reservedId = (await availabilityStatus('RESERVED')).id;
      unavailableId = (await availabilityStatus('UNAVAILABLE')).id;
      borrowedTransactionStatusId = (
        await prisma.borrowStatus.upsert({
          where: { code: 'BORROWED' },
          create: { code: 'BORROWED', name: 'BORROWED' },
          update: { name: 'BORROWED' },
        })
      ).id;
      cancelledBorrowStatusId = (
        await prisma.borrowStatus.upsert({
          where: { code: 'CANCELLED' },
          create: { code: 'CANCELLED', name: 'CANCELLED' },
          update: { name: 'CANCELLED' },
        })
      ).id;
      await prisma.jobStatus.upsert({
        where: { code: 'PENDING_ASSIGN' },
        create: { code: 'PENDING_ASSIGN', name: 'PENDING_ASSIGN' },
        update: { name: 'PENDING_ASSIGN' },
      });
      jobTypeId = (
        await prisma.jobType.create({
          data: { name: 'Integration test repair' },
        })
      ).id;
      assetTypeId = (
        await prisma.assetType.create({
          data: { name: 'Integration test asset' },
        })
      ).id;
      sectionId = (
        await prisma.section.create({
          data: {
            code: `IT-${randomUUID().slice(0, 8)}`,
            name: 'Test asset center',
          },
        })
      ).id;
      targetSectionId = (
        await prisma.section.create({
          data: {
            code: `TO-${randomUUID().slice(0, 8)}`,
            name: 'Test destination',
          },
        })
      ).id;
      companyId = (
        await prisma.company.create({
          data: {
            code: `CO-${randomUUID().slice(0, 8)}`,
            name: 'Test supplier',
          },
        })
      ).id;
      userId = randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          email: `asset-test-${userId}@example.invalid`,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          section_id: sectionId,
        },
      });

      const module = await Test.createTestingModule({
        controllers: [AssetController, RepairsController],
        providers: [
          AssetService,
          RepairsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      app = module.createNestApplication();
      app.use(
        (
          req: Request & {
            session?: {
              user: { id: string; section_id: string; role: string };
            };
          },
          _res: Response,
          next: NextFunction,
        ) => {
          req.session = {
            user: { id: userId, section_id: sectionId, role: 'ADMIN' },
          };
          next();
        },
      );
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    });

    beforeEach(async () => {
      assetId = (
        await prisma.asset.create({
          data: {
            name: 'Patient monitor',
            model: 'PM-100',
            price: 1000,
            receivedDate: new Date('2026-01-01T00:00:00.000Z'),
            type_id: assetTypeId,
            section_id: sectionId,
            company_id: companyId,
            asset_status_id: normalId,
            availability_status_id: availableId,
            owner_id: userId,
            createdBy: userId,
            updatedBy: userId,
          },
        })
      ).id;
    });

    afterEach(async () => {
      if (!assetId) return;
      await prisma.repairJob.deleteMany({ where: { assetId } });
      await prisma.borrowTransaction.deleteMany({
        where: { asset_id: assetId },
      });
      await prisma.disposal.deleteMany({ where: { asset_id: assetId } });
      await prisma.transfer.deleteMany({ where: { asset_id: assetId } });
      await prisma.asset.delete({ where: { id: assetId } });
    });

    afterAll(async () => {
      if (app) await app.close();
      if (prisma) {
        if (userId) await prisma.user.delete({ where: { id: userId } });
        if (companyId)
          await prisma.company.delete({ where: { id: companyId } });
        if (sectionId && targetSectionId)
          await prisma.section.deleteMany({
            where: { id: { in: [sectionId, targetSectionId] } },
          });
        if (assetTypeId)
          await prisma.assetType.delete({ where: { id: assetTypeId } });
        if (jobTypeId)
          await prisma.jobType.delete({ where: { id: jobTypeId } });
        await prisma.$disconnect();
      }
    });

    it('rejects repair intake for a borrowed asset and keeps its loan open', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      const response = await request(server())
        .post('/repairs')
        .send(repairDto())
        .expect(400);
      expect((response.body as { message: string }).message).toMatch(
        /damage return procedure/,
      );
      const asset = await getAsset();
      expect(asset.body.availabilityStatus.code).toBe('BORROWED');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });

    it('rejects repair intake for a reserved asset', async () => {
      await setState(normalId, reservedId);

      await request(server()).post('/repairs').send(repairDto()).expect(400);
      const asset = await getAsset();
      expect(asset.body.availabilityStatus.code).toBe('RESERVED');
    });

    it('accepts repair intake for an available asset', async () => {
      await request(server()).post('/repairs').send(repairDto()).expect(201);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('UNDER_REPAIR');
      expect(asset.body.availabilityStatus.code).toBe('UNAVAILABLE');
    });

    it('accepts repair intake for unborrowed damaged equipment', async () => {
      await setState(damagedId, unavailableId);

      await request(server()).post('/repairs').send(repairDto()).expect(201);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('UNDER_REPAIR');
    });

    it('rejects a transfer while the asset is under repair', async () => {
      await setState(underRepairId, unavailableId);

      await request(server())
        .post(`/asset/${assetId}/transfer`)
        .send(transferDto())
        .expect(400);
      const asset = await getAsset();
      expect(asset.body.section.id).toBe(sectionId);
    });

    it('transfers an eligible asset to its new section', async () => {
      await request(server())
        .post(`/asset/${assetId}/transfer`)
        .send(transferDto())
        .expect(201);
      const asset = await getAsset();
      expect(asset.body.section.id).toBe(targetSectionId);
    });

    it('rejects a forbidden physical status edit on a borrowed asset', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}/status`)
        .send({ asset_status_id: damagedId })
        .expect(400);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('NORMAL');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });

    it('rejects disposal while the asset is reserved', async () => {
      await setState(normalId, reservedId);

      await request(server())
        .post(`/asset/${assetId}/disposal`)
        .send(disposalDto())
        .expect(400);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('NORMAL');
    });

    it('creates a disposal record for an eligible asset', async () => {
      await request(server())
        .post(`/asset/${assetId}/disposal`)
        .send(disposalDto())
        .expect(201);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('DISPOSAL');
      expect(asset.body.availabilityStatus.code).toBe('UNAVAILABLE');
    });

    it('rejects a forbidden status edit through the general update endpoint', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();
      const disposalStatus = await prisma.assetStatus.findUniqueOrThrow({
        where: { code: 'DISPOSAL' },
      });

      await request(server())
        .patch(`/asset/${assetId}`)
        .send({ asset_status_id: disposalStatus.id })
        .expect(400);
      const asset = await getAsset();
      expect(asset.body.status.code).toBe('NORMAL');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });
    it('keeps availability and loan state when editing metadata', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}`)
        .send({
          name: 'Corrected name',
          asset_status_id: normalId,
          availability_status_id: borrowedId,
        })
        .expect(200);
      const asset = await getAsset();
      expect(asset.body.name).toBe('Corrected name');
      expect(asset.body.availabilityStatus.code).toBe('BORROWED');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });

    it('rejects direct availability edits while a loan is active', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}`)
        .send({ availability_status_id: availableId })
        .expect(400);
      const asset = await getAsset();
      expect(asset.body.availabilityStatus.code).toBe('BORROWED');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });

    it('keeps a borrowed asset borrowed when NORMAL is submitted again', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}/status`)
        .send({ asset_status_id: normalId })
        .expect(200);
      const asset = await getAsset();
      expect(asset.body.availabilityStatus.code).toBe('BORROWED');
      expect(asset.body.currentBorrowing.id).toBe(borrow.id);
    });

    it('auto-cascades borrow cancellation when a BORROWED asset is marked LOST', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}/status`)
        .send({ asset_status_id: lostId })
        .expect(200);

      const asset = await getAsset();
      expect(asset.body.status.code).toBe('LOST');
      expect(asset.body.availabilityStatus.code).toBe('UNAVAILABLE');
      expect(asset.body.currentBorrowing).toBeNull();

      const updatedTx = await prisma.borrowTransaction.findUnique({
        where: { id: borrow.id },
      });
      expect(updatedTx?.borrow_status_id).toBe(cancelledBorrowStatusId);
      expect(updatedTx?.cancelled_by_user_id).toBe(userId);
      expect(updatedTx?.cancelled_at).not.toBeNull();
      expect(updatedTx?.cancel_reason).toContain('LOST');
    });

    it('auto-cascades borrow cancellation when a RESERVED asset is marked LOST', async () => {
      await setState(normalId, reservedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}/status`)
        .send({ asset_status_id: lostId })
        .expect(200);

      const asset = await getAsset();
      expect(asset.body.status.code).toBe('LOST');
      expect(asset.body.availabilityStatus.code).toBe('UNAVAILABLE');
      expect(asset.body.currentBorrowing).toBeNull();

      const updatedTx = await prisma.borrowTransaction.findUnique({
        where: { id: borrow.id },
      });
      expect(updatedTx?.borrow_status_id).toBe(cancelledBorrowStatusId);
      expect(updatedTx?.cancelled_by_user_id).toBe(userId);
      expect(updatedTx?.cancelled_at).not.toBeNull();
      expect(updatedTx?.cancel_reason).toContain('LOST');
    });

    it('auto-cascades borrow cancellation when updating status to LOST via general update endpoint', async () => {
      await setState(normalId, borrowedId);
      const borrow = await addBorrow();

      await request(server())
        .patch(`/asset/${assetId}`)
        .send({ asset_status_id: lostId })
        .expect(200);

      const asset = await getAsset();
      expect(asset.body.status.code).toBe('LOST');
      expect(asset.body.availabilityStatus.code).toBe('UNAVAILABLE');
      expect(asset.body.currentBorrowing).toBeNull();

      const updatedTx = await prisma.borrowTransaction.findUnique({
        where: { id: borrow.id },
      });
      expect(updatedTx?.borrow_status_id).toBe(cancelledBorrowStatusId);
      expect(updatedTx?.cancelled_by_user_id).toBe(userId);
      expect(updatedTx?.cancelled_at).not.toBeNull();
    });
  },
);
