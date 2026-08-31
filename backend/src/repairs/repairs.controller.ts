import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RepairsService } from './repairs.service';
import { CreateRepairRequestDto } from './dto/create-repair-request.dto';
import { DiagnoseRepairJobDto } from './dto/diagnose-repair-job.dto';
import { UpdateRepairStepDto } from './dto/update-repair-step.dto';
import { ReturnRepairSparePartDto } from './dto/return-repair-spare-part.dto';
import { CompleteRepairJobDto } from './dto/complete-repair-job.dto';
import { QueryRepairJobDto } from './dto/query-repair-job.dto';

@ApiTags('Repairs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('repairs')
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Online Request (แจ้งซ่อม) - UC3
  // ───────────────────────────────────────────────────────────────────────────
  @Post()
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({ summary: 'Submit an online repair request ticket (UC3)' })
  @ApiResponse({ status: 201, description: 'Repair ticket created successfully' })
  async createRequest(
    @Body() dto: CreateRepairRequestDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.createRequest(dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Lookups & Metadata
  // ───────────────────────────────────────────────────────────────────────────
  @Get('lookups/meta')
  @ApiOperation({ summary: 'Get repair lookup tables (Causes, Tech categories, Job types, Step masters)' })
  async getLookups() {
    return this.repairsService.getLookups();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. List & Detail - UC8
  // ───────────────────────────────────────────────────────────────────────────
  @Get()
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get paginated list of repair jobs with filtering' })
  async findAll(
    @Query() query: QueryRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.findAll(query, session.user);
  }

  @Get(':id')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get single repair job details including all 12 steps & spare parts' })
  async findOne(@Param('id') id: string) {
    return this.repairsService.findOne(id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Mechanic Diagnosis & Action Type Selection - UC8
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id/diagnose')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mechanic diagnoses job, selects ActionType, and clones 12 steps' })
  async diagnose(
    @Param('id') id: string,
    @Body() dto: DiagnoseRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.diagnoseAndPlan(id, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Update Step Progress (Steps 1 - 12)
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id/steps/:stepNumber')
  @Roles(
    UserRole.MAINTENANCE_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Update progress of a specific repair step (1 to 12)' })
  async updateStep(
    @Param('id') id: string,
    @Param('stepNumber', ParseIntPipe) stepNumber: number,
    @Body() dto: UpdateRepairStepDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.updateStepProgress(id, stepNumber, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Spare Parts Requisition & Return within Repair Job
  // ───────────────────────────────────────────────────────────────────────────
  @Post(':id/spare-parts/withdraw')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.PARCEL_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Withdraw / dedicate spare parts to repair job (INTERNAL_STOCK)' })
  async withdrawSparePart(
    @Param('id') id: string,
    @Body() body: { sparepartId: number; qty: number },
    @Session() session: UserSession,
  ) {
    return this.repairsService.withdrawSparePart(id, body.sparepartId, body.qty, session.user);
  }

  @Post(':id/spare-parts/return')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Return unused spare parts back into warehouse inventory' })
  async returnSparePart(
    @Param('id') id: string,
    @Body() dto: ReturnRepairSparePartDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.returnSparePart(id, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Complete, Handover & Close Job (Step 12)
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id/complete')
  @Roles(
    UserRole.MAINTENANCE_STAFF,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Complete repair job, record warranty, handover asset, and set asset to NORMAL/AVAILABLE' })
  async completeJob(
    @Param('id') id: string,
    @Body() dto: CompleteRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.completeAndCloseJob(id, dto, session.user);
  }
}
