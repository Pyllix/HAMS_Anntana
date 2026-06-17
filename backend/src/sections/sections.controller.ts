import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@ApiTags('Section')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) { }

  // ─── Create ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create new Section',
    description: 'Create new Section',
  })
  @ApiResponse({
    status: 201,
    description: 'Section created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  create(@Body() createSectionDto: CreateSectionDto) {
    return this.sectionsService.create(createSectionDto);
  }

  // ─── Read All ──────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Get all Sections',
    description: 'Get all Sections',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all Sections',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  findAll() {
    return this.sectionsService.findAll();
  }

  // ─── Read One ──────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get Section by ID',
    description: 'Get Section by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Return Section by ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  findOne(@Param('id') id: string) {
    return this.sectionsService.findOne(+id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({
    summary: 'Update Section by ID',
    description: 'Update Section by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Return Section by ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  update(@Param('id') id: string, @Body() updateSectionDto: UpdateSectionDto) {
    return this.sectionsService.update(+id, updateSectionDto);
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft Delete Section by ID',
    description: 'Soft Delete Section by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Section deleted successfully (soft delete)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  remove(@Param('id') id: string) {
    return this.sectionsService.remove(+id);
  }

  // ─── Restore ───────────────────────────────────────────────────────────────
  @Patch(':id/restore')
  @ApiOperation({
    summary: 'Restore a soft-deleted Section',
    description: 'Restore a soft-deleted section back to active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Section restored successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  restore(@Param('id') id: string) {
    return this.sectionsService.restore(+id);
  }
}
