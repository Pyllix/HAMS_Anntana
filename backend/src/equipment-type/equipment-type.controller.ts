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
import { EquipmentTypeService } from './equipment-type.service';
import { CreateEquipmentTypeDto } from './dto/create-equipment-type.dto';
import { UpdateEquipmentTypeDto } from './dto/update-equipment-type.dto';

@ApiTags('Equipment Types')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('equipment-types')
export class EquipmentTypeController {
  constructor(private readonly equipmentTypeService: EquipmentTypeService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Create a new equipment type' })
  async create(@Body() dto: CreateEquipmentTypeDto) {
    return this.equipmentTypeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all equipment types' })
  async findAll() {
    return this.equipmentTypeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get equipment type by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentTypeService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Update an equipment type' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipmentTypeDto,
  ) {
    return this.equipmentTypeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Delete an equipment type' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentTypeService.remove(id);
  }
}
