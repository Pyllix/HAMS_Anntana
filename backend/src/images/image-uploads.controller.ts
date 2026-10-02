import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CompleteImageUploadDto } from './dto/complete-image-upload.dto';
import { CreateImageUploadDto } from './dto/create-image-upload.dto';
import { ImageUploadService } from './image-upload.service';

@UseGuards(AuthGuard)
@ApiCookieAuth()
@ApiTags('Images')
@Controller('images/uploads')
export class ImageUploadsController {
  constructor(private readonly imageUploadService: ImageUploadService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Create a direct image upload intent',
    description:
      'Allocates a single-use image identity and returns server-signed Cloudinary upload fields. HAMS never receives image bytes.',
  })
  @ApiBody({ type: CreateImageUploadDto })
  @ApiResponse({ status: 201, description: 'Upload authorization created' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Role cannot upload this purpose' })
  @ApiResponse({ status: 429, description: 'Upload request budget reached' })
  createIntent(
    @Body() dto: CreateImageUploadDto,
    @Session() session: UserSession,
  ): ReturnType<ImageUploadService['createIntent']> {
    return this.imageUploadService.createIntent(
      {
        userId: session.user.id,
        role: session.user.role as UserRole,
      },
      dto,
    );
  }

  @Post(':uploadId/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Verify an uploaded image as a pending image',
    description:
      'Checks provider-signed upload evidence and independently verifies the preallocated object. Does not attach the image to a record.',
  })
  @ApiBody({ type: CompleteImageUploadDto })
  @ApiResponse({ status: 200, description: 'Verified pending upload status' })
  @ApiResponse({
    status: 404,
    description: 'Upload was not found for uploader',
  })
  @ApiResponse({
    status: 409,
    description: 'Upload evidence or state is invalid',
  })
  @ApiResponse({ status: 410, description: 'Upload attachment window expired' })
  @ApiResponse({ status: 503, description: 'Image storage is unavailable' })
  complete(
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Body() dto: CompleteImageUploadDto,
    @Session() session: UserSession,
  ): ReturnType<ImageUploadService['complete']> {
    return this.imageUploadService.complete(
      {
        userId: session.user.id,
        role: session.user.role as UserRole,
      },
      uploadId,
      dto,
    );
  }

  @Get(':uploadId')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Read an upload status',
    description:
      'Returns status only to the original uploader while they still have permission for the image purpose.',
  })
  @ApiResponse({ status: 200, description: 'Upload status' })
  @ApiResponse({
    status: 404,
    description: 'Upload was not found for uploader',
  })
  getStatus(
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Session() session: UserSession,
  ): ReturnType<ImageUploadService['getStatus']> {
    return this.imageUploadService.getStatus(
      {
        userId: session.user.id,
        role: session.user.role as UserRole,
      },
      uploadId,
    );
  }

  @Get(':uploadId/preview')
  @Roles(UserRole.ADMIN, UserRole.ASSET_CENTER_STAFF, UserRole.PARCEL_STAFF)
  @ApiOperation({
    summary: 'Get a preview URL for a verified pending image',
    description:
      'Returns a preview only to the original uploader while the verified upload is live and the uploader still has permission for its purpose. Employee Photos use a short-lived restricted grant.',
  })
  @ApiResponse({ status: 200, description: 'Verified pending image preview' })
  @ApiResponse({ status: 403, description: 'Current role cannot preview it' })
  @ApiResponse({
    status: 404,
    description: 'Upload was not found for uploader',
  })
  @ApiResponse({ status: 410, description: 'Upload attachment window expired' })
  @ApiResponse({ status: 503, description: 'Image storage is unavailable' })
  preview(
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @Session() session: UserSession,
  ): ReturnType<ImageUploadService['getPreview']> {
    return this.imageUploadService.getPreview(
      {
        userId: session.user.id,
        role: session.user.role as UserRole,
      },
      uploadId,
    );
  }
}
