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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Spare Parts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly sparePartsService: SparePartsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Create new Spare Part', description: 'ลงทะเบียนอะไหล่ใหม่เข้าระบบ' })
  @ApiResponse({ status: 201, description: 'Spare part created successfully' })
  @ApiResponse({ status: 409, description: 'Spare part code already exists' })
  create(
    @Body() dto: CreateSparepartDto,
    @Session() session: UserSession,
  ) {
    return this.sparePartsService.create(dto, session.user.id);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({ summary: 'Find all Spare Parts (paginated)', description: 'ดึงรายการอะไหล่พร้อม pagination, ค้นหารหัส/ชื่อ, กรองกลุ่ม หรือกรองเฉพาะที่สต็อกต่ำ' })
  findAll(@Query() query: QuerySparepartDto) {
    return this.sparePartsService.findAll(query);
  }

  @Get('low-stock')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({ summary: 'Get Low Stock Summary', description: 'ดึงรายงานสรุปอะไหล่ที่สต็อกต่ำกว่าเกณฑ์ขั้นต่ำ พร้อมจำนวนที่ต้องสั่งซื้อเพิ่ม' })
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
  @ApiOperation({ summary: 'Find all Spare Part Transactions (paginated)', description: 'ดึงสมุดรายการเบิก-จ่าย-คืนอะไหล่ทั้งหมด' })
  findAllTransactions(@Query() query: QuerySparepartTxnDto) {
    return this.sparePartsService.findAllTransactions(query);
  }

  @Post('stock-in')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Stock-in Spare Part', description: 'รับอะไหล่เข้าคลัง เพิ่มยอดสต็อกและบันทึกประวัติการสั่งซื้อ/รับของ' })
  @ApiResponse({ status: 201, description: 'Stock-in recorded successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  stockIn(
    @Body() dto: StockInSparepartDto,
    @Session() session: UserSession,
  ) {
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
  @ApiOperation({ summary: 'Find one Spare Part', description: 'ดูข้อมูลรายละเอียดของอะไหล่' })
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
  @ApiOperation({ summary: 'Get Spare Part Timeline / History', description: 'ดึงประวัติกิจกรรมทั้งหมดของอะไหล่ (รับเข้าสต็อก, เบิกจ่าย, คืน)' })
  findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationDto,
  ) {
    return this.sparePartsService.findSparepartHistory(id, query);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Update Spare Part', description: 'แก้ไขข้อมูลอะไหล่' })
  @ApiResponse({ status: 200, description: 'Spare part updated successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSparepartDto,
  ) {
    return this.sparePartsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Delete Spare Part', description: 'Soft-delete อะไหล่' })
  @ApiResponse({ status: 200, description: 'Spare part deleted successfully' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sparePartsService.remove(id);
  }
}
