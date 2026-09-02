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
import { CauseService } from './cause.service';
import { CreateCauseDto } from './dto/create-cause.dto';
import { UpdateCauseDto } from './dto/update-cause.dto';

@ApiTags('Causes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('causes')
export class CauseController {
  constructor(private readonly causeService: CauseService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Create a new repair cause' })
  async create(@Body() dto: CreateCauseDto) {
    return this.causeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all repair causes' })
  async findAll() {
    return this.causeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repair cause by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.causeService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Update a repair cause' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCauseDto,
  ) {
    return this.causeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Soft delete a repair cause' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.causeService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Restore a soft-deleted repair cause' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.causeService.restore(id);
  }
}
