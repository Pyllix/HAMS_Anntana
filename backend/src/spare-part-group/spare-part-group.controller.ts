import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { SparePartGroupService } from './spare-part-group.service';
import { CreateSparePartGroupDto } from './dto/create-spare-part-group.dto';
import { UpdateSparePartGroupDto } from './dto/update-spare-part-group.dto';

@ApiTags('Spare Part Groups')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('spare-part-groups')
export class SparePartGroupController {
  constructor(private readonly sparePartGroupService: SparePartGroupService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Create new Spare Part Group', description: 'สร้างกลุ่ม/หมวดหมู่อะไหล่ใหม่' })
  @ApiResponse({ status: 201, description: 'Spare part group created successfully' })
  @ApiResponse({ status: 409, description: 'Group name already exists' })
  create(@Body() dto: CreateSparePartGroupDto) {
    return this.sparePartGroupService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({ summary: 'Find all Spare Part Groups (paginated)', description: 'ดึงรายชื่อกลุ่มอะไหล่ทั้งหมดพร้อมจำนวนอะไหล่ในกลุ่ม' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: PaginationDto) {
    return this.sparePartGroupService.findAll(query);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
  )
  @ApiOperation({ summary: 'Find one Spare Part Group', description: 'ดึงข้อมูลกลุ่มอะไหล่และรายชื่ออะไหล่ที่อยู่ในกลุ่ม' })
  @ApiResponse({ status: 200, description: 'Group found successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sparePartGroupService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Update Spare Part Group', description: 'แก้ไขชื่อกลุ่มอะไหล่' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSparePartGroupDto,
  ) {
    return this.sparePartGroupService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF, UserRole.ASSET_CENTER_STAFF)
  @ApiOperation({ summary: 'Delete Spare Part Group', description: 'ลบกลุ่มอะไหล่ (เฉพาะกลุ่มที่ไม่มีอะไหล่ผูกอยู่)' })
  @ApiResponse({ status: 200, description: 'Group deleted successfully' })
  @ApiResponse({ status: 400, description: 'Group contains active spare parts' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sparePartGroupService.remove(id);
  }
}
