import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AcqTypeService } from './acq-type.service';
import { CreateAcqTypeDto } from './dto/create-acq-type.dto';
import { UpdateAcqTypeDto } from './dto/update-acq-type.dto';

@ApiTags('Acquisition Types')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('acq-types')
export class AcqTypeController {
  constructor(private readonly acqTypeService: AcqTypeService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Create a new acquisition type' })
  async create(@Body() dto: CreateAcqTypeDto) {
    return this.acqTypeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active acquisition types' })
  async findAll() {
    return this.acqTypeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get acquisition type by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.acqTypeService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Update an acquisition type' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAcqTypeDto,
  ) {
    return this.acqTypeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Soft delete an acquisition type' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.acqTypeService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Restore a soft-deleted acquisition type' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.acqTypeService.restore(id);
  }
}
