import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AssetBorrowService } from './asset-borrow.service';
import { CreateAssetBorrowDto } from './dto/create-asset-borrow.dto';
import { ReturnAssetBorrowDto } from './dto/return-asset-borrow.dto';
import { RequestReturnBorrowDto } from './dto/request-return-borrow.dto';
import { CompleteReturnBorrowDto } from './dto/complete-return-borrow.dto';
import { RejectBorrowDto } from './dto/reject-borrow.dto';
import { BorrowFilterDto } from './dto/borrow-filter.dto';
import { CancelBorrowDto } from './dto/cancel-borrow.dto';
import { CreateBorrowExtensionDto } from './dto/create-borrow-extension.dto';
import { ReviewBorrowExtensionDto } from './dto/review-borrow-extension.dto';
import { BorrowExtensionFilterDto } from './dto/borrow-extension-filter.dto';
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
  @ApiResponse({ status: 400, description: 'Transaction is not PENDING_APPROVE' })
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
  @ApiResponse({ status: 400, description: 'Transaction is not PENDING_APPROVE' })
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

  // Request Return / Call Pickup (BORROWED -> PENDING_RETURN) by Department Staff
  @Patch(':id/request-return')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({ summary: 'Ward requests pickup return for borrowed asset (BORROWED -> PENDING_RETURN)' })
  @ApiResponse({ status: 200, description: 'Return request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Transaction is not BORROWED or no permission' })
  async requestReturn(
    @Param('id') id: string,
    @Body() dto: RequestReturnBorrowDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.requestReturn(id, dto, session.user);
  }

  // Claim Pickup Job (PENDING_RETURN -> IN_PICKUP) by Asset Center Staff
  @Patch(':id/claim-pickup')
  @Roles(UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Asset Center Staff claims pickup job (PENDING_RETURN -> IN_PICKUP)' })
  @ApiResponse({ status: 200, description: 'Pickup job claimed successfully' })
  @ApiResponse({ status: 400, description: 'Transaction is not PENDING_RETURN' })
  async claimPickup(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.claimPickup(id, session.user);
  }

  // Complete Return / Receive in Warehouse (IN_PICKUP / PENDING_RETURN -> RETURNED) by Asset Center Staff
  @Patch(':id/complete-return')
  @Roles(UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Asset Center Staff inspects and completes return in warehouse (IN_PICKUP -> RETURNED)' })
  @ApiResponse({ status: 200, description: 'Asset return completed and verified' })
  @ApiResponse({ status: 400, description: 'Transaction is not in IN_PICKUP status' })
  async completeReturn(
    @Param('id') id: string,
    @Body() dto: CompleteReturnBorrowDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.completeReturn(id, dto, session.user);
  }

  // Walk-in Desk Return (BORROWED -> RETURNED) by Asset Center Staff
  @Patch(':id/return')
  @Roles(UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Walk-in desk return at Asset Center (BORROWED -> RETURNED in 1 step)' })
  @ApiResponse({ status: 200, description: 'Asset returned successfully at desk' })
  @ApiResponse({ status: 400, description: 'Transaction is not BORROWED or cross-department invalid' })
  async returnAsset(
    @Param('id') id: string,
    @Body() dto: ReturnAssetBorrowDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.returnAsset(id, dto, session.user);
  }

  // Request / Perform Borrow Extension (DESK or ONLINE)
  @Post(':id/extensions')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
  )
  @ApiOperation({ summary: 'Create borrow extension (auto DESK if ASSET_CENTER_STAFF, ONLINE request if DEPARTMENT_STAFF)' })
  @ApiResponse({ status: 201, description: 'Extension created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or invalid status' })
  @ApiResponse({ status: 409, description: 'Pending extension already exists' })
  async createExtension(
    @Param('id') id: string,
    @Body() dto: CreateBorrowExtensionDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.createExtension(id, dto, session.user);
  }

  // Get all extension records for a specific borrowing
  @Get(':id/extensions')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
  )
  @ApiOperation({ summary: 'Get all extension records for a borrow transaction' })
  @ApiResponse({ status: 200, description: 'List of extensions returned' })
  async findExtensionsByBorrowId(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.findExtensionsByBorrowId(id, session.user);
  }

  // List all extension requests (Inbox / Dashboard for Asset Center)
  @Get('extensions/requests')
  @Roles(
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'List all extension requests with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of extension requests' })
  async findAllExtensions(
    @Query() query: BorrowExtensionFilterDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.findAllExtensions(query, session.user);
  }

  // Review (Approve or Reject) an extension request
  @Patch('extensions/:extensionId/review')
  @Roles(UserRole.ASSET_CENTER_STAFF, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Review (APPROVE or REJECT) an extension request' })
  @ApiResponse({ status: 200, description: 'Extension review recorded and transaction updated if approved' })
  @ApiResponse({ status: 400, description: 'Invalid status or missing reason' })
  async reviewExtension(
    @Param('extensionId') extensionId: string,
    @Body() dto: ReviewBorrowExtensionDto,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.reviewExtension(extensionId, dto, session.user);
  }

  // Cancel a pending extension request by borrower
  @Patch('extensions/:extensionId/cancel')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.ASSET_CENTER_STAFF,
  )
  @ApiOperation({ summary: 'Cancel a pending extension request' })
  @ApiResponse({ status: 200, description: 'Extension request cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Extension is not in PENDING status or no permission' })
  async cancelExtension(
    @Param('extensionId') extensionId: string,
    @Session() session: UserSession,
  ) {
    return this.assetBorrowService.cancelExtension(extensionId, session.user);
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
  @ApiQuery({ name: 'borrowNo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
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

