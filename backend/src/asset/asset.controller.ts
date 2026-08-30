import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { CreateAssetDisposalDto } from './dto/create-asset-disposal.dto';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Asset')
@Controller('asset')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  // ─── Asset CRUD ────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Create new Asset', description: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createAssetDto: CreateAssetDto, @Session() session: UserSession) {
    return this.assetService.create(createAssetDto, session.user.id);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Find all Assets (paginated)', description: 'Find all assets with pagination and optional search by name, model or serial number' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of assets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: PaginationDto) {
    return this.assetService.findAll(query);
  }

  @Get('disposal')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Find all Completed Disposal Records (paginated)', description: 'Find all completed disposal records across all assets with pagination and optional search' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of completed disposal records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllDisposalRecords(@Query() query: PaginationDto) {
    return this.assetService.findAllDisposalRecords(query);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({ summary: 'Find one Asset', description: 'Find one asset by ID' })
  @ApiResponse({ status: 200, description: 'Asset found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id') id: string) {
    return this.assetService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Update one Asset', description: 'Update asset fields' })
  @ApiResponse({ status: 200, description: 'Asset updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  update(
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
    @Session() session: UserSession,
  ) {
    return this.assetService.update(id, updateAssetDto, session.user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Update Asset Status directly', description: 'Directly update asset status (e.g. WAIT_DISPOSAL, NORMAL, LOST)' })
  @ApiResponse({ status: 200, description: 'Asset status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  updateStatus(
    @Param('id') id: string,
    @Body('asset_status_id', ParseIntPipe) assetStatusId: number,
    @Session() session: UserSession,
  ) {
    return this.assetService.updateStatus(id, assetStatusId, session.user.id);
  }

  // ─── Disposal ─────────────────────────────────────────────────────────────

  @Post(':id/disposal')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Create Disposal Record',
    description:
      'Record an asset disposal (disposal_doc_no, approved_date). ' +
      'This action automatically updates the asset status to DISPOSAL and availability to UNAVAILABLE.',
  })
  @ApiResponse({ status: 201, description: 'Disposal record created' })
  @ApiResponse({ status: 400, description: 'Status transition not allowed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  createDisposal(
    @Param('id') id: string,
    @Body() createAssetDisposalDto: CreateAssetDisposalDto,
    @Session() session: UserSession,
  ) {
    return this.assetService.createDisposal(id, createAssetDisposalDto, session.user.id);
  }

  @Get(':id/disposal')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.DEPARTMENT_STAFF,
  )
  @ApiOperation({
    summary: 'Get Disposal History for Asset',
    description: 'Get all disposal records for an asset, ordered by most recent first.',
  })
  @ApiResponse({ status: 200, description: 'Disposal records found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findDisposalRecords(@Param('id') id: string) {
    return this.assetService.findDisposalRecords(id);
  }
}
