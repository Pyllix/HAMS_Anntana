import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { CreateAssetLostDto } from './dto/create-asset-lost.dto';
import { CreateAssetDisposalDto } from './dto/create-asset-disposal.dto';
import { CompleteAssetDisposalDto } from './dto/complete-asset-disposal.dto';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Find all Assets', description: 'Find all assets' })
  @ApiResponse({ status: 200, description: 'Assets found successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.assetService.findAll();
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

  // ─── Update Status ─────────────────────────────────────────────────────────
  // Asset ไม่มีการลบข้อมูล — ใช้การเปลี่ยน AssetStatus แทน (Lost, Disposal ฯลฯ)

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update Asset status',
    description: 'Change asset status (e.g. Lost, Disposal) — Asset is never deleted, only its status changes.',
  })
  @ApiResponse({ status: 200, description: 'Asset status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateAssetStatusDto: UpdateAssetStatusDto,
    @Session() session: UserSession,
  ) {
    return this.assetService.updateStatus(id, updateAssetStatusDto, session.user.id);
  }

  // ─── Lost History ──────────────────────────────────────────────────────────

  @Post(':id/lost')
  @ApiOperation({
    summary: 'Report Asset as Lost',
    description:
      'Record a lost event for the asset (date discovered, last seen location, reason). ' +
      'Update asset status separately via PATCH /:id/status.',
  })
  @ApiResponse({ status: 201, description: 'Lost record created successfully' })
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
      'Register the asset as Pending Disposal. Provide disposal_status_id referencing ' +
      'the PENDING_DISPOSAL row in asset_status, and the reason for pending.',
  })
  @ApiResponse({ status: 201, description: 'Disposal record created (pending)' })
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
      'Mark the disposal record as completed (DISPOSED). ' +
      'Requires the disposal record to exist and not already be completed.',
  })
  @ApiResponse({ status: 200, description: 'Disposal completed successfully' })
  @ApiResponse({ status: 400, description: 'Disposal already completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset or disposal record not found' })
  completeDisposal(
    @Param('id') id: string,
    @Param('disposalId', ParseIntPipe) disposalId: number,
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
