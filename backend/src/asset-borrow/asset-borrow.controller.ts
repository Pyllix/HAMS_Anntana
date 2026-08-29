import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AssetBorrowService } from './asset-borrow.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { RejectBorrowDto } from './dto/reject-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { CancelBorrowDto } from './dto/cancel-borrow.dto';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Borrowings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('borrowings')
export class AssetBorrowController {
  constructor(private readonly assetBorrowService: AssetBorrowService) { }
  // Create Borrowing
  @Post()
  @Roles(
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Create a new borrow transaction' })
  @ApiResponse({ status: 201, description: 'Borrow transaction created' })
  @ApiResponse({ status: 409, description: 'Asset not available' })
  async createBorrow(@Body() dto: CreateAssetBorrowDto, @Session() session: UserSession) {
    return this.assetBorrowService.createBorrow(dto, session.user);
  }
  // Approve Borrowing
  @Patch(':id/approve')
  @Roles(UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Approve a borrow request' })
  @ApiResponse({ status: 200, description: 'Borrow request approved' })
  @ApiResponse({ status: 400, description: 'Transaction is not PENDING_APPROVAL' })
  async approveBorrow(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.approveBorrow(id, session.user);
  }

  // Reject Borrowing
  @Patch(':id/reject')
  @Roles(UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Reject a borrow request' })
  @ApiResponse({ status: 200, description: 'Borrow request rejected' })
  @ApiResponse({ status: 400, description: 'Transaction is not PENDING_APPROVAL' })
  async rejectBorrow(
    @Param('id') id: string,
    @Body() dto: RejectBorrowDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.rejectBorrow(id, dto?.reason, session.user);
  }

  // Handover / Dispatch Asset (APPROVED -> BORROWED)
  @Patch(':id/handover')
  @Roles(UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Handover/dispatch asset to borrower (APPROVED -> BORROWED)' })
  @ApiResponse({ status: 200, description: 'Asset handed over successfully' })
  @ApiResponse({ status: 400, description: 'Transaction is not in APPROVED status' })
  async handoverAsset(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.handoverAsset(id, session.user);
  }

  // Return Borrowing
  @Patch(':id/return')
  @Roles(
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Return a borrowed asset' })
  @ApiResponse({ status: 200, description: 'Asset returned successfully' })
  @ApiResponse({ status: 400, description: 'Transaction is not BORROWED' })
  async returnAsset(
    @Param('id') id: string,
    @Body() dto: ReturnAssetBorrowDto,
    @Session() session: UserSession
  ) {
    return this.assetBorrowService.returnAsset(id, dto, session.user);
  }

  // Cancel Borrowing
  @Patch(':id/cancel')
  @Roles(
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Cancel a borrow transaction' })
  @ApiResponse({ status: 200, description: 'Transaction cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Transaction cannot be cancelled or no permission' })
  async cancelBorrow(
    @Param('id') id: string,
    @Body() dto: CancelBorrowDto,
    @Session() session: UserSession
  ) {
    return this.assetBorrowService.cancelBorrow(id, dto, session.user);
  }
  // Get All Borrowing
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'List borrow transactions with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'assetId', required: false, type: String })
  @ApiQuery({ name: 'borrowerId', required: false, type: String })
  @ApiQuery({ name: 'borrowStatusId', required: false, type: Number })
  async findAll(@Query() query: BorrowFilterDto, @Session() session: UserSession) {
    return this.assetBorrowService.findAll(query, session.user);
  }
  // Get Borrowing By ID
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Get details of a borrow transaction' })
  @ApiResponse({ status: 200, description: 'Transaction details returned' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async findOne(@Param('id') id: string, @Session() session: UserSession) {
    return this.assetBorrowService.findOne(id, session.user);
  }
}
