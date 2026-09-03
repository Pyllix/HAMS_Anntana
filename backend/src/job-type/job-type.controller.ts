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
import { JobTypeService } from './job-type.service';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { UpdateJobTypeDto } from './dto/update-job-type.dto';

@ApiTags('Job Types')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('job-types')
export class JobTypeController {
  constructor(private readonly jobTypeService: JobTypeService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Create a new repair job type' })
  async create(@Body() dto: CreateJobTypeDto) {
    return this.jobTypeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all repair job types' })
  async findAll() {
    return this.jobTypeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repair job type by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jobTypeService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Update a repair job type' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobTypeDto,
  ) {
    return this.jobTypeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Soft delete a repair job type' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.jobTypeService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Restore a soft-deleted repair job type' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.jobTypeService.restore(id);
  }
}
