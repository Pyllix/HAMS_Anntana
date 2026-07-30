import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { CreateAssetLostDto } from './dto/create-asset-lost.dto';
import { CreateAssetDisposalDto } from './dto/create-asset-disposal.dto';
import { CompleteAssetDisposalDto } from './dto/complete-asset-disposal.dto';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Asset')
@Controller('asset')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  // ─── Asset CRUD ────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create new Asset', description: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createAssetDto: CreateAssetDto, @Session() session: UserSession) {
    return this.assetService.create(createAssetDto, session.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Find all Assets (paginated)', description: 'Find all assets with pagination and optional search by name, model or serial number' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of assets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() query: PaginationDto) {
    return this.assetService.findAll(query);
  }

  @Get('lost')
  @ApiOperation({ summary: 'Find all Lost Records (paginated)', description: 'Find all lost event records across all assets with pagination and optional search by asset name, model or serial number' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of lost records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllLostRecords(@Query() query: PaginationDto) {
    return this.assetService.findAllLostRecords(query);
  }

  @Get('wait-disposal')
  @ApiOperation({ summary: 'Find all Wait Disposal Records (paginated)', description: 'Find all records currently in wait-disposal state across all assets with pagination and optional search by asset name, model or serial number' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of wait-disposal records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllWaitDisposalRecords(@Query() query: PaginationDto) {
    return this.assetService.findAllWaitDisposalRecords(query);
  }

  @Get('disposal')
  @ApiOperation({ summary: 'Find all Completed Disposal Records (paginated)', description: 'Find all completed disposal records across all assets with pagination and optional search by asset name, model or serial number' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of completed disposal records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllCompletedDisposalRecords(@Query() query: PaginationDto) {
    return this.assetService.findAllCompletedDisposalRecords(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find one Asset', description: 'Find one asset by ID' })
  @ApiResponse({ status: 200, description: 'Asset found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id') id: string) {
    return this.assetService.findOne(id);
  }

  @Patch(':id')
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

  // ─── Lost History ──────────────────────────────────────────────────────────

  @Post(':id/lost')
  @ApiOperation({
    summary: 'Report Asset as Lost',
    description:
      'Record a lost event for the asset (date discovered, last seen location, reason). ' +
      'This action automatically updates the asset status to LOST. ' +
      'Allowed from status: NORMAL, DAMAGED, UNDER_REPAIR. ' +
      'Terminal states (DISPOSAL, LOST) cannot transition.',
  })
  @ApiResponse({ status: 201, description: 'Lost record created successfully' })
  @ApiResponse({ status: 400, description: 'Status transition not allowed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  reportLost(
    @Param('id') id: string,
    @Body() createAssetLostDto: CreateAssetLostDto,
    @Session() session: UserSession,
  ) {
    return this.assetService.reportLost(id, createAssetLostDto, session.user.id);
  }

  @Get(':id/lost')
  @ApiOperation({
    summary: 'Get Lost History',
    description: 'Get all lost event records for an asset, ordered by most recent first.',
  })
  @ApiResponse({ status: 200, description: 'Lost records found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findLostRecords(@Param('id') id: string) {
    return this.assetService.findLostRecords(id);
  }

  // ─── Disposal Workflow ─────────────────────────────────────────────────────

  @Post(':id/disposal')
  @ApiOperation({
    summary: 'Create Disposal Record (Step 1: Pending)',
    description:
      'Register the asset as Wait Disposal. ' +
      'This action automatically updates the asset status to WAIT_DISPOSAL. ' +
      'Allowed from status: NORMAL, DAMAGED, UNDER_REPAIR. ' +
      'Terminal states (DISPOSAL, LOST) cannot transition.',
  })
  @ApiResponse({ status: 201, description: 'Disposal record created (pending)' })
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

  @Patch(':id/disposal/:disposalId')
  @ApiOperation({
    summary: 'Complete Disposal (Step 2: Disposed)',
    description:
      'Mark the disposal record as completed (DISPOSAL). ' +
      'This action automatically updates the asset status to DISPOSAL. ' +
      'Allowed from status: WAIT_DISPOSAL only. ' +
      'Requires the disposal record to exist and not already be completed.',
  })
  @ApiResponse({ status: 200, description: 'Disposal completed successfully' })
  @ApiResponse({ status: 400, description: 'Status transition not allowed or disposal already completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset or disposal record not found' })
  completeDisposal(
    @Param('id') id: string,
    @Param('disposalId') disposalId: string,
    @Body() completeAssetDisposalDto: CompleteAssetDisposalDto,
    @Session() session: UserSession,
  ) {
    return this.assetService.completeDisposal(id, disposalId, completeAssetDisposalDto, session.user.id);
  }

  @Get(':id/disposal')
  @ApiOperation({
    summary: 'Get Disposal History',
    description: 'Get all disposal records for an asset, ordered by most recent first.',
  })
  @ApiResponse({ status: 200, description: 'Disposal records found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findDisposalRecords(@Param('id') id: string) {
    return this.assetService.findDisposalRecords(id);
  }
}
