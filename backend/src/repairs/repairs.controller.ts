import {
  Body,
  Controller,
  Get,
  Param,
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
import { RejectRepairStepDto } from './dto/reject-repair-step.dto';
import { CancelRepairJobDto } from './dto/cancel-repair-job.dto';
import { ReturnRepairSparePartDto } from './dto/return-repair-spare-part.dto';
import { QueryRepairJobDto } from './dto/query-repair-job.dto';
import { AssignRepairJobDto } from './dto/assign-repair-job.dto';
import { CompleteUnrepairableDto } from './dto/complete-unrepairable.dto';
import { UpdateRepairRequestDto } from './dto/update-repair-request.dto';

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
    UserRole.MAINTENANCE_HEAD,
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
  // 2. Lookups & Workload Balancing
  // ───────────────────────────────────────────────────────────────────────────
  @Get('lookups/meta')
  @ApiOperation({ summary: 'Get repair lookup tables (Causes, Tech categories, Job types, Step masters)' })
  async getLookups() {
    return this.repairsService.getLookups();
  }

  @Get('mechanic-workloads')
  @Roles(
    UserRole.MAINTENANCE_HEAD,
    UserRole.MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get active workload counts of all mechanics for balanced job dispatch' })
  async getMechanicWorkloads() {
    return this.repairsService.getMechanicWorkloads();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. List & Detail - UC8
  // ───────────────────────────────────────────────────────────────────────────
  @Get()
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.MAINTENANCE_HEAD,
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

  @Get('mechanics')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.MAINTENANCE_HEAD,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get list of active mechanics (users with MAINTENANCE_STAFF or MAINTENANCE_HEAD role)' })
  async getMechanics() {
    return this.repairsService.getMechanics();
  }

  @Get(':id')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_STAFF,
    UserRole.MAINTENANCE_HEAD,
    UserRole.ASSET_CENTER_STAFF,
    UserRole.PARCEL_STAFF,
    UserRole.MANAGER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get single repair job details including steps, spare parts, and cost breakdown' })
  async findOne(@Param('id') id: string) {
    return this.repairsService.findOne(id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Ticket Modification & Triage Assignment
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id')
  @Roles(
    UserRole.DEPARTMENT_STAFF,
    UserRole.MAINTENANCE_HEAD,
    UserRole.ADMIN,
    UserRole.MANAGER,
  )
  @ApiOperation({ summary: 'Edit repair ticket details while pending assignment' })
  async updateRepairRequest(
    @Param('id') id: string,
    @Body() dto: UpdateRepairRequestDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.updateRepairRequest(id, dto, session.user);
  }

  @Post(':id/assign')
  @Roles(UserRole.MAINTENANCE_HEAD)
  @ApiOperation({ summary: 'Head mechanic triages and assigns job to one or more technicians' })
  async assignJob(
    @Param('id') id: string,
    @Body() dto: AssignRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.assignJob(id, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Mechanic Diagnosis & Action Type Selection (4 Tracks)
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id/diagnose')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.MAINTENANCE_HEAD)
  @ApiOperation({ summary: 'Mechanic diagnoses job, selects one of 4 ActionTracks, and plans operational steps' })
  async diagnose(
    @Param('id') id: string,
    @Body() dto: DiagnoseRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.diagnoseAndPlan(id, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Update Step Progress (Auto-Advance & Specific Steps)
  // ───────────────────────────────────────────────────────────────────────────
  @Patch(':id/steps/next')
  @Roles(
    UserRole.MAINTENANCE_STAFF,
    UserRole.MAINTENANCE_HEAD,
    UserRole.PARCEL_STAFF,
    UserRole.MANAGER,
  )
  @ApiOperation({ summary: 'Advance to and complete the next pending repair step automatically' })
  async advanceNextStep(
    @Param('id') id: string,
    @Body() dto: UpdateRepairStepDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.advanceNextStep(id, dto, session.user);
  }

  @Patch(':id/steps/reject')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reject/disapprove the pending approval step and return job for re-diagnosis' })
  async rejectStep(
    @Param('id') id: string,
    @Body() dto: RejectRepairStepDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.rejectStep(id, dto, session.user);
  }

  @Patch(':id/complete-unrepairable')
  @Roles(UserRole.PARCEL_STAFF, UserRole.MANAGER)
  @ApiOperation({ summary: 'Parcel staff confirms physical custody of unrepairable equipment and updates asset to WAIT_DISPOSAL' })
  async completeUnrepairable(
    @Param('id') id: string,
    @Body() dto: CompleteUnrepairableDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.completeUnrepairable(id, dto, session.user);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.MAINTENANCE_STAFF, UserRole.MAINTENANCE_HEAD)
  @ApiOperation({ summary: 'Technician or head cancels repair job ticket before approval/in-progress and restores asset to NORMAL' })
  async cancelJob(
    @Param('id') id: string,
    @Body() dto: CancelRepairJobDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.cancelRepairJob(id, dto, session.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Spare Parts Return within Repair Job
  // ───────────────────────────────────────────────────────────────────────────
  @Post(':id/spare-parts/return')
  @Roles(UserRole.PARCEL_STAFF)
  @ApiOperation({ summary: 'Parcel staff confirms physical receipt and returns unused spare parts back into stock' })
  async returnSparePart(
    @Param('id') id: string,
    @Body() dto: ReturnRepairSparePartDto,
    @Session() session: UserSession,
  ) {
    return this.repairsService.returnSparePart(id, dto, session.user);
  }
}
