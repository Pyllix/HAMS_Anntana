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
import { BudgetTypeService } from './budget-type.service';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { UpdateBudgetTypeDto } from './dto/update-budget-type.dto';

@ApiTags('Budget Types')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('budget-types')
export class BudgetTypeController {
  constructor(private readonly budgetTypeService: BudgetTypeService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Create a new budget type' })
  async create(@Body() dto: CreateBudgetTypeDto) {
    return this.budgetTypeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active budget types' })
  @ApiQuery({ name: 'fiscalYear', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('fiscalYear') fiscalYear?: string,
    @Query('isActive') isActive?: string,
  ) {
    const year = fiscalYear ? Number(fiscalYear) : undefined;
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.budgetTypeService.findAll(year, active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget type by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.budgetTypeService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Update a budget type' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBudgetTypeDto,
  ) {
    return this.budgetTypeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Soft delete a budget type' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.budgetTypeService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Restore a soft-deleted budget type' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.budgetTypeService.restore(id);
  }
}
