import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AssetViabilityService } from './asset-viability.service';
import { QueryAssetViabilityDto } from './dto/query-asset-viability.dto';
import {
  AssetViabilityDetailResponseDto,
  AssetViabilityListResponseDto,
} from './dto/asset-viability-response.dto';

@ApiTags('Asset Viability')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class AssetViabilityController {
  constructor(private readonly assetViabilityService: AssetViabilityService) {}

  @Get('assets/viability')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MAINTENANCE_HEAD, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Find paginated assets with economic viability assessment and summary KPI counters',
    description:
      'Evaluates assets using Rule-based Decision Tree (EQM-WI-040) based on cumulative repair cost ratio, useful life, and repair breakdown frequency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated viability audit list with KPI summary',
    type: AssetViabilityListResponseDto,
  })
  findAll(@Query() query: QueryAssetViabilityDto) {
    return this.assetViabilityService.findAll(query);
  }

  @Get('asset/viability')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MAINTENANCE_HEAD, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Alias for GET /assets/viability (singular "asset" path)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated viability audit list with KPI summary',
    type: AssetViabilityListResponseDto,
  })
  findAllAlias(@Query() query: QueryAssetViabilityDto) {
    return this.assetViabilityService.findAll(query);
  }

  @Get('assets/:id/viability')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MAINTENANCE_HEAD, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Find single asset deep-dive viability assessment',
    description:
      'Provides itemized repair history, cumulative outsource & spare parts costs, and pre-filled disposal recommendation payload.',
  })
  @ApiResponse({
    status: 200,
    description: 'Single asset viability detail',
    type: AssetViabilityDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id') id: string) {
    return this.assetViabilityService.findOne(id);
  }

  @Get('asset/:id/viability')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MAINTENANCE_HEAD, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Alias for GET /assets/:id/viability (singular "asset" path)',
  })
  @ApiResponse({
    status: 200,
    description: 'Single asset viability detail',
    type: AssetViabilityDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOneAlias(@Param('id') id: string) {
    return this.assetViabilityService.findOne(id);
  }
}
