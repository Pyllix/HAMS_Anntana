import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { AssetStatusService } from './asset-status.service';
import { CreateAssetStatusDto } from './dto/create-asset-status.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@ApiTags('Asset Status')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('asset-status')
export class AssetStatusController {
  constructor(private readonly assetStatusService: AssetStatusService) {}

  // ─── Create ────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Create new asset status' })
  @ApiResponse({ status: 201, description: 'Asset Status created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Asset status code already exists' })
  create(@Body() createAssetStatusDto: CreateAssetStatusDto) {
    return this.assetStatusService.create(createAssetStatusDto);
  }

  // ─── Read All ──────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get all asset statuses' })
  @ApiResponse({ status: 200, description: 'Return all asset statuses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll() {
    return this.assetStatusService.findAll();
  }

  // ─── Read One ──────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get asset status by ID' })
  @ApiResponse({ status: 200, description: 'Return asset status by ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Status not found' })
  findOne(@Param('id') id: string) {
    return this.assetStatusService.findOne(+id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Update asset status by ID' })
  @ApiResponse({ status: 200, description: 'Return updated asset status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Status not found' })
  update(@Param('id') id: string, @Body() updateAssetStatusDto: UpdateAssetStatusDto) {
    return this.assetStatusService.update(+id, updateAssetStatusDto);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft Delete Asset Status by ID' })
  @ApiResponse({ status: 200, description: 'Asset Status deleted successfully (soft delete)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Status not found' })
  remove(@Param('id') id: string) {
    return this.assetStatusService.remove(+id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted asset status' })
  @ApiResponse({ status: 200, description: 'Asset Status restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Deleted asset status not found' })
  restore(@Param('id') id: string) {
    return this.assetStatusService.restore(+id);
  }
}
