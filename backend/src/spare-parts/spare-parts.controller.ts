import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { SparePartsService } from './spare-parts.service';
import { CreateSparepartDto } from './dto/create-spare-part.dto';
import { UpdateSparepartDto } from './dto/update-spare-part.dto';
import { QuerySparepartDto } from './dto/query-spare-part.dto';
import { StockInSparepartDto } from './dto/stock-in-spare-part.dto';
import { QuerySparepartTxnDto } from './dto/query-spare-part-txn.dto';
import { QueryStockInHistoryDto } from './dto/query-stock-in-history.dto';
import { SPAREPART_TXN_TYPES } from './spare-part-transaction.constants';

@ApiTags('Spare Parts')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly sparePartsService: SparePartsService) {}

  @Post()
  @Roles(UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Create new Spare Part',
    description: 'ลงทะเบียนอะไหล่ใหม่เข้าระบบ',
  })
  @ApiResponse({ status: 201, description: 'Spare part created successfully' })
  @ApiResponse({ status: 409, description: 'Spare part code already exists' })
  create(@Body() dto: CreateSparepartDto, @Session() session: UserSession) {
    return this.sparePartsService.create(dto, session.user.id);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.MAINTENANCE_HEAD,
  )
  @ApiOperation({
    summary: 'Find all Spare Parts (paginated)',
    description:
      'ดึงรายการอะไหล่พร้อม pagination, ค้นหารหัส/ชื่อ, กรองกลุ่ม หรือกรองเฉพาะที่สต็อกต่ำ',
  })
  @ApiQuery({
    name: 'stockStatus',
    required: false,
    enum: ['NORMAL', 'LOW', 'OUT'],
  })
  findAll(
    @Query() query: QuerySparepartDto,
  ): ReturnType<SparePartsService['findAll']> {
    return this.sparePartsService.findAll(query);
  }

  @Get('summary')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Return exact spare-part type counts by stock state',
  })
  getStockSummary(): ReturnType<SparePartsService['getStockSummary']> {
    return this.sparePartsService.getStockSummary();
  }

  @Get('low-stock')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Get Low Stock Summary',
    description:
      'ดึงรายงานสรุปอะไหล่ที่สต็อกต่ำกว่าเกณฑ์ขั้นต่ำ พร้อมจำนวนที่ต้องสั่งซื้อเพิ่ม',
  })
  getLowStockSummary() {
    return this.sparePartsService.findLowStockSummary();
  }

  @Get('transactions')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Find all Spare Part Transactions (paginated)',
    description:
      'ดึงประวัติเบิก-คืนอะไหล่แบบแบ่งหน้า หากไม่ระบุ txnType จะแสดงเฉพาะรายการเบิกและคืน; ค้นหารหัส/ชื่ออะไหล่หรือเลขใบงานด้วย search และกรองวันที่ตาม txnDate ในเขตเวลา Asia/Bangkok',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'หมายเลขหน้า เริ่มต้นที่ 1 (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'จำนวนรายการต่อหน้า default 20 และสูงสุด 100',
  })
  @ApiQuery({
    name: 'sparepartId',
    required: false,
    type: Number,
    description: 'กรองตาม ID อะไหล่',
  })
  @ApiQuery({
    name: 'jobId',
    required: false,
    type: String,
    description: 'กรองตาม UUID ของใบงานซ่อม',
  })
  @ApiQuery({
    name: 'txnType',
    required: false,
    enum: SPAREPART_TXN_TYPES,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'ค้นหารหัส/ชื่ออะไหล่หรือเลขใบงาน (ไม่สนตัวพิมพ์เล็ก/ใหญ่)',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'กรองตาม UUID ของผู้บันทึกรายการ',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'กรอง txnDate ตั้งแต่ต้นวันใน Asia/Bangkok (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'กรอง txnDate ถึงสิ้นวันใน Asia/Bangkok (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated transaction rows with minimal sparepart, repairJob, and recordedBy objects',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 42 },
              txnType: {
                type: 'string',
                enum: [...SPAREPART_TXN_TYPES],
                example: 'WITHDRAW',
              },
              stockType: {
                type: 'string',
                nullable: true,
                enum: ['INTERNAL', 'EXTERNAL', null],
                example: 'INTERNAL',
              },
              txnDate: { type: 'string', format: 'date-time' },
              qty: { type: 'integer', example: 2 },
              sparepart: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  code: { type: 'string' },
                  name: { type: 'string' },
                  unit: { type: 'string' },
                },
              },
              repairJob: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  jobNo: { type: 'string' },
                },
              },
              recordedBy: {
                type: 'object',
                description:
                  'Account that recorded or confirmed this transaction',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 36 },
            totalPages: { type: 'integer', example: 2 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  findAllTransactions(
    @Query() query: QuerySparepartTxnDto,
  ): ReturnType<SparePartsService['findAllTransactions']> {
    return this.sparePartsService.findAllTransactions(query);
  }

  @Get('stock-in-history')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Find Stock-In History (paginated)',
    description:
      'ดึงประวัติการรับเข้าอะไหล่/เติมสต็อก พร้อมฟิลเตอร์ค้นหาและแบ่งหน้า',
  })
  findStockInHistory(@Query() query: QueryStockInHistoryDto) {
    return this.sparePartsService.findStockInHistory(query);
  }

  @Post('stock-in')
  @Roles(UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Stock-in Spare Part',
    description:
      'รับอะไหล่เข้าคลัง เพิ่มยอดสต็อกและบันทึกประวัติการสั่งซื้อ/รับของ',
  })
  @ApiResponse({ status: 201, description: 'Stock-in recorded successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  stockIn(@Body() dto: StockInSparepartDto, @Session() session: UserSession) {
    return this.sparePartsService.stockIn(dto, session.user.id);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Find one Spare Part',
    description: 'ดูข้อมูลรายละเอียดของอะไหล่',
  })
  @ApiResponse({ status: 200, description: 'Spare part found successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sparePartsService.findOne(id);
  }

  @Get(':id/history')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({
    summary: 'Get Spare Part Timeline / History',
    description:
      'ดึงประวัติกิจกรรมทั้งหมดของอะไหล่ (รับเข้าสต็อก, เบิกจ่าย, คืน)',
  })
  findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationDto,
  ) {
    return this.sparePartsService.findSparepartHistory(id, query);
  }

  @Patch(':id')
  @Roles(UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Update Spare Part',
    description: 'แก้ไขข้อมูลอะไหล่',
  })
  @ApiResponse({ status: 200, description: 'Spare part updated successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSparepartDto,
  ) {
    return this.sparePartsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Delete Spare Part',
    description: 'Soft-delete อะไหล่',
  })
  @ApiResponse({ status: 200, description: 'Spare part deleted successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sparePartsService.remove(id);
  }
}
