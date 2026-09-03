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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { TechCategoryService } from './tech-category.service';
import { CreateTechCategoryDto } from './dto/create-tech-category.dto';
import { UpdateTechCategoryDto } from './dto/update-tech-category.dto';

@ApiTags('Tech Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tech-categories')
export class TechCategoryController {
  constructor(private readonly techCategoryService: TechCategoryService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Create a new tech category' })
  async create(@Body() dto: CreateTechCategoryDto) {
    return this.techCategoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tech categories' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(@Query('isActive') isActive?: string) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.techCategoryService.findAll(active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tech category by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.techCategoryService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Update a tech category' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechCategoryDto,
  ) {
    return this.techCategoryService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Soft delete a tech category' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.techCategoryService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.MAINTENANCE_STAFF)
  @ApiOperation({ summary: 'Restore a soft-deleted tech category' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.techCategoryService.restore(id);
  }
}
