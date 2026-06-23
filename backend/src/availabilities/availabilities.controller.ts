import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { AvailabilitiesService } from './availabilities.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@ApiTags('Availabilities')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('availabilities')
export class AvailabilitiesController {
  constructor(private readonly availabilitiesService: AvailabilitiesService) {}

  // ─── Create ────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Create new availability status' })
  @ApiResponse({ status: 201, description: 'Availability Status created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Availability status code already exists' })
  create(@Body() createAvailabilityDto: CreateAvailabilityDto) {
    return this.availabilitiesService.create(createAvailabilityDto);
  }

  // ─── Read All ──────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get all availability statuses' })
  @ApiResponse({ status: 200, description: 'Return all availability statuses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll() {
    return this.availabilitiesService.findAll();
  }

  // ─── Read One ──────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get availability status by ID' })
  @ApiResponse({ status: 200, description: 'Return availability status by ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Availability Status not found' })
  findOne(@Param('id') id: string) {
    return this.availabilitiesService.findOne(+id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Update availability status by ID' })
  @ApiResponse({ status: 200, description: 'Return updated availability status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Availability Status not found' })
  update(@Param('id') id: string, @Body() updateAvailabilityDto: UpdateAvailabilityDto) {
    return this.availabilitiesService.update(+id, updateAvailabilityDto);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft Delete Availability Status by ID' })
  @ApiResponse({ status: 200, description: 'Availability Status deleted successfully (soft delete)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Availability Status not found' })
  remove(@Param('id') id: string) {
    return this.availabilitiesService.remove(+id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted availability status' })
  @ApiResponse({ status: 200, description: 'Availability Status restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Deleted availability status not found' })
  restore(@Param('id') id: string) {
    return this.availabilitiesService.restore(+id);
  }
}
