import { UserRole } from '@prisma/client';
import { AssetBorrowService } from '../../asset-borrow/asset-borrow.service';
import { RepairsService } from '../../repairs/repairs.service';
import { PrismaService } from '../../prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { employeeIdPrefix } from '../../users/employee-id';

describe('Service date boundaries', () => {
  const start = new Date('2026-12-31T17:00:00.000Z');
  const end = new Date('2027-01-01T16:59:59.999Z');
  const user = { id: 'admin-1', role: UserRole.ADMIN };

  function database() {
    return {
      borrowTransaction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      borrowExtension: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      repairJob: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
  }

  it('filters borrowed and due dates by the entire selected Thai day', async () => {
    const db = database();
    const service = new AssetBorrowService(db as unknown as PrismaService, {} as NotificationsService);
    await service.findAll({ startDate: '2027-01-01', endDate: '2027-01-01', expectedReturnStartDate: '2027-01-01', expectedReturnEndDate: '2027-01-01' }, user);
    expect(db.borrowTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      createdAt: { gte: start, lte: end }, expectedReturnDate: { gte: start, lte: end },
    }) }));
  });

  it('filters extension requests by the entire selected Thai day', async () => {
    const db = database();
    const service = new AssetBorrowService(db as unknown as PrismaService, {} as NotificationsService);
    await service.findAllExtensions({ startDate: '2027-01-01', endDate: '2027-01-01' }, user);
    expect(db.borrowExtension.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: start, lte: end } }) }));
  });

  it('filters repair reports by the entire selected Thai day', async () => {
    const db = database();
    const service = new RepairsService(db as unknown as PrismaService, {} as NotificationsService);
    await service.findAll({ startDate: '2027-01-01', endDate: '2027-01-01' }, user);
    expect(db.repairJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: start, lte: end } }) }));
  });

  it('uses the Thai year for employee IDs before the server UTC year changes', () => {
    expect(employeeIdPrefix(new Date('2026-12-31T17:00:00Z'))).toBe('GOV-70');
  });
});
