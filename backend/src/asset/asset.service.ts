import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { CreateAssetDisposalDto } from './dto/create-asset-disposal.dto';
import { AssetFilterDto } from './dto/asset-filter.dto';
import { PrismaService } from 'src/prisma.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { paginate, PaginatedResult } from 'src/common/utils/paginate.util';
import { Prisma } from '@prisma/client';

/**
 * Asset Status Transition Map
 * กำหนดว่าแต่ละ target status รับ transition มาจาก status ใดได้บ้าง
 */
const ALLOWED_FROM: Record<string, string[]> = {
  NORMAL: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR'],
  LOST: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR'],
  WAIT_DISPOSAL: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR'],
  DISPOSAL: ['NORMAL', 'DAMAGED', 'UNDER_REPAIR', 'WAIT_DISPOSAL'],
  DAMAGED: ['NORMAL'],
  UNDER_REPAIR: ['DAMAGED', 'NORMAL'],
};

/** Include block ที่ใช้ซ้ำทุก asset query */
const ASSET_INCLUDE = {
  status: { select: { id: true, code: true, name: true } },
  availabilityStatus: { select: { id: true, code: true, name: true } },
  type: { select: { id: true, name: true } },
  equipmentType: { select: { id: true, name: true } },
  section: { select: { id: true, code: true, name: true, building: true } },
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, employeeId: true, firstname: true, lastname: true } },
  borrowTransactions: {
    where: {
      borrowStatus: {
        code: { in: ['BORROWED', 'PENDING_APPROVE'] as string[] },
      },
    },
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      borrower_id: true,
      borrow_status_id: true,
      request_source: true,
      delivery_method: true,
      createdAt: true,
      borrower: {
        select: {
          id: true,
          employeeId: true,
          firstname: true,
          lastname: true,
        },
      },
      borrowStatus: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.AssetInclude;

/**
 * แปลง date string → Date object สำหรับ DateTime field ของ Asset
 */
function toAssetDates(dto: Record<string, any>) {
  return {
    ...dto,
    receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : undefined,
  };
}

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Status Transition Guard ─────────────────────────────────────────────

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

  private transformAsset(asset: any) {
    if (!asset) return asset;
    const { borrowTransactions, ...rest } = asset;
    return {
      ...rest,
      currentBorrowing: Array.isArray(borrowTransactions) && borrowTransactions.length > 0
        ? borrowTransactions[0]
        : null,
    };
  }

  async create(createAssetDto: CreateAssetDto, userId: string) {
    const { createdBy: _ignore, updatedBy: _ignore2, ...dto } = createAssetDto as any;
    const asset = await this.prisma.asset.create({
      data: { ...toAssetDates(dto), createdBy: userId, updatedBy: userId } as any,
      include: ASSET_INCLUDE,
    });
    return this.transformAsset(asset);
  }

  async findAll(query: AssetFilterDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {
      ...(query.section_id && { section_id: query.section_id }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
              { serialNo: { contains: query.search, mode: 'insensitive' } },
              { noid: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: ASSET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    const formattedData = data.map((item) => this.transformAsset(item));
    return paginate(formattedData as Record<string, unknown>[], total, page, limit);
  }

  /**
   * ดึง Asset ตาม Section ID (paginated)
   */
  async findBySection(sectionId: string, query: PaginationDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException(`Section #${sectionId} not found`);
    }
    return this.findAll({ ...query, section_id: sectionId });
  }

  /**
   * ดึง Asset ของแผนกผู้ใช้งานที่ Login อยู่ (paginated)
   */
  async findMySectionAssets(userId: string, query: PaginationDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { section_id: true },
    });

    if (!user || !user.section_id) {
      throw new BadRequestException('ผู้ใช้งานไม่ได้สังกัดแผนกใดๆ');
    }

    return this.findAll({ ...query, section_id: user.section_id });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE,
    });
    if (!asset) throw new NotFoundException(`Asset #${id} not found`);
    return this.transformAsset(asset);
  }

  private async getConsistentAvailabilityStatusId(targetStatusCode: string): Promise<number | undefined> {
    let targetAvailabilityCode: string;
    if (['DAMAGED', 'UNDER_REPAIR', 'WAIT_DISPOSAL', 'DISPOSAL', 'LOST'].includes(targetStatusCode)) {
      targetAvailabilityCode = 'UNAVAILABLE';
    } else if (targetStatusCode === 'NORMAL') {
      targetAvailabilityCode = 'AVAILABLE';
    } else {
      return undefined;
    }

    const avail = await this.prisma.availabilityStatus.findUnique({
      where: { code: targetAvailabilityCode },
    });
    return avail?.id;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, userId: string) {
    const asset = await this.findOne(id);
    const { createdBy: _ignore, updatedBy: _ignore2, ...dto } = updateAssetDto as any;

    let autoAvailabilityId: number | undefined = undefined;
    if (dto.asset_status_id && !dto.availability_status_id) {
      const targetStatus = await this.prisma.assetStatus.findUnique({
        where: { id: dto.asset_status_id },
      });
      if (targetStatus) {
        this.validateStatusTransition(asset.status.code, targetStatus.code);
        autoAvailabilityId = await this.getConsistentAvailabilityStatusId(targetStatus.code);
      }
    }

    const payload = toAssetDates(dto);
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...payload,
        ...(autoAvailabilityId !== undefined && { availability_status_id: autoAvailabilityId }),
        updatedBy: userId,
      },
      include: ASSET_INCLUDE,
    });
    return this.transformAsset(updated);
  }

  // ─── Status Edit ──────────────────────────────────────────────────────────

  async updateStatus(id: string, assetStatusId: number, userId: string) {
    const asset = await this.findOne(id);
    const targetStatus = await this.prisma.assetStatus.findUnique({
      where: { id: assetStatusId },
    });
    if (!targetStatus) {
      throw new NotFoundException(`AssetStatus #${assetStatusId} not found`);
    }

    this.validateStatusTransition(asset.status.code, targetStatus.code);

    const availabilityStatusId = await this.getConsistentAvailabilityStatusId(targetStatus.code);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        asset_status_id: assetStatusId,
        ...(availabilityStatusId !== undefined && { availability_status_id: availabilityStatusId }),
        updatedBy: userId,
      },
      include: ASSET_INCLUDE,
    });
    return this.transformAsset(updated);
  }

  // ─── Disposal ─────────────────────────────────────────────────────────────

  /** ดึงประวัติการจำหน่ายทั้งหมด (DISPOSAL) (paginated) */
  async findAllDisposalRecords(query: PaginationDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DisposalWhereInput = query.search
      ? {
          OR: [
            { disposalDocNo: { contains: query.search, mode: 'insensitive' } },
            {
              asset: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { model: { contains: query.search, mode: 'insensitive' } },
                  { serialNo: { contains: query.search, mode: 'insensitive' } },
                  { noid: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.disposal.findMany({
        where,
        orderBy: { approvedDate: 'desc' },
        include: { asset: { include: ASSET_INCLUDE } },
        skip,
        take: limit,
      }),
      this.prisma.disposal.count({ where }),
    ]);

    return paginate(data as Record<string, unknown>[], total, page, limit);
  }

  /**
   * สร้างระเบียนจำหน่าย (Disposal) พร้อมปรับสถานะ Asset เป็น DISPOSAL
   */
  async createDisposal(id: string, dto: CreateAssetDisposalDto, userId: string) {
    const asset = await this.findOne(id);
    this.validateStatusTransition(asset.status.code, 'DISPOSAL');

    const disposalStatus = await this.prisma.assetStatus.findUnique({ where: { code: 'DISPOSAL' } });
    if (!disposalStatus) throw new NotFoundException('Status DISPOSAL not found');

    const unavailableStatus = await this.prisma.availabilityStatus.findUnique({ where: { code: 'UNAVAILABLE' } });

    return this.prisma.$transaction(async (prisma) => {
      await prisma.asset.update({
        where: { id },
        data: {
          asset_status_id: disposalStatus.id,
          availability_status_id: unavailableStatus?.id,
          updatedBy: userId,
        },
      });

      return prisma.disposal.create({
        data: {
          asset_id: id,
          disposalDocNo: dto.disposalDocNo,
          approvedDate: new Date(dto.approvedDate),
        },
        include: {
          asset: { include: ASSET_INCLUDE },
        },
      });
    });
  }

  /** ดึงประวัติการจำหน่ายของ Asset รายเครื่อง */
  async findDisposalRecords(id: string) {
    await this.findOne(id);
    return this.prisma.disposal.findMany({
      where: { asset_id: id },
      orderBy: { approvedDate: 'desc' },
    });
  }
}
