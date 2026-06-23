import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { AssetTypeService } from './asset-type.service';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@ApiTags('Asset Type')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('asset-type')
export class AssetTypeController {
  constructor(private readonly assetTypeService: AssetTypeService) {}

  // ─── Create ────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Create new asset type' })
  @ApiResponse({ status: 201, description: 'Asset Type created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createAssetTypeDto: CreateAssetTypeDto) {
    return this.assetTypeService.create(createAssetTypeDto);
  }

  // ─── Read All ──────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get all asset types' })
  @ApiResponse({ status: 200, description: 'Return all asset types' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll() {
    return this.assetTypeService.findAll();
  }

  // ─── Read One ──────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get asset type by ID' })
  @ApiResponse({ status: 200, description: 'Return asset type by ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Type not found' })
  findOne(@Param('id') id: string) {
    return this.assetTypeService.findOne(+id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Update asset type by ID' })
  @ApiResponse({ status: 200, description: 'Return updated asset type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Type not found' })
  update(@Param('id') id: string, @Body() updateAssetTypeDto: UpdateAssetTypeDto) {
    return this.assetTypeService.update(+id, updateAssetTypeDto);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft Delete Asset Type by ID' })
  @ApiResponse({ status: 200, description: 'Asset Type deleted successfully (soft delete)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset Type not found' })
  remove(@Param('id') id: string) {
    return this.assetTypeService.remove(+id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted asset type' })
  @ApiResponse({ status: 200, description: 'Asset Type restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Deleted asset type not found' })
  restore(@Param('id') id: string) {
    return this.assetTypeService.restore(+id);
  }
}
