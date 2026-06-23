import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { CreateAssetLostDto } from './dto/create-asset-lost.dto';
import { CreateAssetDisposalDto } from './dto/create-asset-disposal.dto';
import { CompleteAssetDisposalDto } from './dto/complete-asset-disposal.dto';
import { PrismaService } from 'src/prisma.service';

/**
 * Asset Status Transition Map
 * กำหนดว่าแต่ละ target status รับ transition มาจาก status ใดได้บ้าง
 * อ้างอิงจาก asset_status_rule.md
 *
 * หมายเหตุ: DAMAGED → LOST / WAIT_DISPOSAL และ UNDER_REPAIR → LOST / WAIT_DISPOSAL
 * ถูกรวมไว้แต่ยังไม่มี endpoint สำหรับการเปลี่ยนไป DAMAGED / UNDER_REPAIR
 */
const ALLOWED_FROM: Record<string, string[]> = {
  // สูญหาย: มาจาก NORMAL, DAMAGED, UNDER_REPAIR ได้
  LOST: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR'],
  // รอจำหน่าย: มาจาก NORMAL, DAMAGED, UNDER_REPAIR ได้
  WAIT_DISPOSAL: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR'],
  // จำหน่าย: มาจาก WAIT_DISPOSAL เท่านั้น
  DISPOSAL: ['WAIT_DISPOSAL'],
};

/** Include block ที่ใช้ซ้ำทุก asset query */
const ASSET_INCLUDE = {
  status: { select: { id: true, code: true, name: true } },
  availabilityStatus: { select: { id: true, code: true, name: true } },
  type: { select: { id: true, name: true } },
  section: { select: { id: true, code: true, name: true, building: true } },
  company: { select: { id: true, name: true } },
} as const;

/**
 * แปลง date string “2022-01-01” → Date object สำหรับทุก DateTime field ของ Asset
 * Prisma ต้องการ Date object หรือ ISO-8601 แบบเต็ม — date-only string จะล้ม (premature end of input)
 */
function toAssetDates(dto: Record<string, any>) {
  return {
    ...dto,
    receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : undefined,
    warrantyDate: dto.warrantyDate ? new Date(dto.warrantyDate) : undefined,
    disposalApprovedDate: dto.disposalApprovedDate ? new Date(dto.disposalApprovedDate) : undefined,
  };
}

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Status Transition Guard ─────────────────────────────────────────────

  /**
   * ตรวจสอบว่า asset สามารถเปลี่ยนไปยัง targetStatusCode ได้หรือไม่
   * ตาม transition map ที่กำหนดใน asset_status_rule.md
   */
  private validateStatusTransition(
    currentStatusCode: string,
    targetStatusCode: string,
  ): void {
    const allowed = ALLOWED_FROM[targetStatusCode] ?? [];
    if (!allowed.includes(currentStatusCode)) {
      throw new BadRequestException(
        `ไม่สามารถเปลี่ยนสถานะจาก "${currentStatusCode}" ไปยัง "${targetStatusCode}" ได้`,
      );
    }
  }

  // ─── Asset CRUD ───────────────────────────────────────────────────────────

  async create(createAssetDto: CreateAssetDto, userId: string) {
    const { createdBy: _ignore, ...dto } = createAssetDto as any;
    return this.prisma.asset.create({
      data: { ...toAssetDates(dto), createdBy: userId, updatedBy: userId } as any,
      include: ASSET_INCLUDE,
    });
  }

  async findAll() {
    return this.prisma.asset.findMany({ include: ASSET_INCLUDE });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE,
    });
    if (!asset) throw new NotFoundException(`Asset #${id} not found`);
    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, userId: string) {
    await this.findOne(id);
    const { createdBy: _ignore, ...dto } = updateAssetDto as any;
    return this.prisma.asset.update({
      where: { id },
      data: { ...toAssetDates(dto), updatedBy: userId } as any,
      include: ASSET_INCLUDE,
    });
  }

  // ─── Lost History ─────────────────────────────────────────────────────────

  /** ดึงประวัติการสูญหายของ Asset ทั้งหมด */
  async findAllLostRecords() {
    return this.prisma.assetLost.findMany({
      orderBy: { discoveredAt: 'desc' },
      include: { asset: { include: ASSET_INCLUDE }, creator: true, updater: true },
    });
  }

  /**
   * รายงานครุภัณฑ์สูญหาย
   * บันทึกลง asset_lost พร้อมรายละเอียดเหตุการณ์
   */
  async reportLost(id: string, dto: CreateAssetLostDto, userId: string) {
    const asset = await this.findOne(id);
    this.validateStatusTransition(asset.status.code, 'LOST');

    const lostStatus = await this.prisma.assetStatus.findUnique({ where: { code: 'LOST' } });
    if (!lostStatus) throw new NotFoundException('Status LOST not found');

    return this.prisma.$transaction(async (prisma) => {
      await prisma.asset.update({
        where: { id },
        data: { asset_status_id: lostStatus.id, updatedBy: userId },
      });
      return prisma.assetLost.create({
        data: {
          asset_id: id,
          discoveredAt: new Date(dto.discoveredAt),
          lastSeenLocation: dto.lastSeenLocation,
          reason: dto.reason,
          createdBy: userId,
          updatedBy: userId,
        },
        include: { asset: { include: ASSET_INCLUDE }, creator: true },
      });
    });
  }

  /** ดึงประวัติการสูญหายของ Asset */
  async findLostRecords(id: string) {
    await this.findOne(id);
    return this.prisma.assetLost.findMany({
      where: { asset_id: id },
      orderBy: { discoveredAt: 'desc' },
      include: { creator: true, updater: true },
    });
  }

  // ─── Disposal Workflow ────────────────────────────────────────────────────

  /** ดึงประวัติรอจำหน่ายทั้งหมด (WAIT_DISPOSAL) */
  async findAllWaitDisposalRecords() {
    return this.prisma.assetDisposal.findMany({
      where: { disposalStatus: { code: 'WAIT_DISPOSAL' } },
      orderBy: { pendingAt: 'desc' },
      include: { asset: { include: ASSET_INCLUDE }, disposalStatus: true, creator: true, updater: true },
    });
  }

  /** ดึงประวัติการจำหน่ายทั้งหมด (DISPOSAL) */
  async findAllCompletedDisposalRecords() {
    return this.prisma.assetDisposal.findMany({
      where: { disposalStatus: { code: 'DISPOSAL' } },
      orderBy: { disposedAt: 'desc' },
      include: { asset: { include: ASSET_INCLUDE }, disposalStatus: true, creator: true, updater: true },
    });
  }

  /**
   * ขั้นตอนที่ 1: สร้างระเบียนรอจำหน่าย (PENDING_DISPOSAL)
   * disposal_status_id ต้องชี้ไปที่ AssetStatus ที่มี code = 'PENDING_DISPOSAL'
   */
  async createDisposal(id: string, dto: CreateAssetDisposalDto, userId: string) {
    const asset = await this.findOne(id);
    this.validateStatusTransition(asset.status.code, 'WAIT_DISPOSAL');

    const waitDisposalStatus = await this.prisma.assetStatus.findUnique({ where: { code: 'WAIT_DISPOSAL' } });
    if (!waitDisposalStatus) throw new NotFoundException('Status WAIT_DISPOSAL not found');

    return this.prisma.$transaction(async (prisma) => {
      await prisma.asset.update({
        where: { id },
        data: { asset_status_id: waitDisposalStatus.id, updatedBy: userId },
      });
      return prisma.assetDisposal.create({
        data: {
          asset_id: id,
          disposal_status_id: waitDisposalStatus.id,
          pendingReason: dto.pendingReason,
          pendingAt: new Date(dto.pendingAt),
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          asset: { include: ASSET_INCLUDE },
          disposalStatus: true,
          creator: true,
        },
      });
    });
  }

  /**
   * ขั้นตอนที่ 2: อัปเดตระเบียนเป็นจำหน่ายแล้ว (DISPOSED)
   * ตรวจสอบว่า disposal record มีอยู่จริงและเป็น PENDING ก่อนเสมอ
   */
  async completeDisposal(
    assetId: string,
    disposalId: string,
    dto: CompleteAssetDisposalDto,
    userId: string,
  ) {
    const asset = await this.findOne(assetId);
    this.validateStatusTransition(asset.status.code, 'DISPOSAL');

    const disposalStatus = await this.prisma.assetStatus.findUnique({ where: { code: 'DISPOSAL' } });
    if (!disposalStatus) throw new NotFoundException('Status DISPOSAL not found');

    const disposal = await this.prisma.assetDisposal.findFirst({
      where: { id: disposalId, asset_id: assetId },
      include: { disposalStatus: true },
    });
    if (!disposal) {
      throw new NotFoundException(`Disposal record #${disposalId} not found for asset #${assetId}`);
    }
    if (disposal.disposedAt !== null) {
      throw new BadRequestException(`Disposal record #${disposalId} is already completed`);
    }
    return this.prisma.$transaction(async (prisma) => {
      await prisma.asset.update({
        where: { id: assetId },
        data: { asset_status_id: disposalStatus.id, updatedBy: userId },
      });
      return prisma.assetDisposal.update({
        where: { id: disposalId },
        data: {
          disposal_status_id: disposalStatus.id,
          disposedAt: new Date(dto.disposedAt),
          disposalReason: dto.disposalReason,
          remark: dto.remark,
          updatedBy: userId,
        },
        include: {
          asset: { include: ASSET_INCLUDE },
          disposalStatus: true,
          creator: true,
          updater: true,
        },
      });
    });
  }

  /** ดึงประวัติการจำหน่ายของ Asset */
  async findDisposalRecords(id: string) {
    await this.findOne(id);
    return this.prisma.assetDisposal.findMany({
      where: { asset_id: id },
      orderBy: { pendingAt: 'desc' },
      include: { disposalStatus: true, creator: true, updater: true },
    });
  }
}
