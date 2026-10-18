import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  IMAGE_STORAGE,
  ImageStorageError,
  type ImageObjectReference,
  type ImageStoragePort,
  isLocalImageStoragePort,
} from './image-storage.port';

@Controller('images/employees')
@ApiTags('Images')
export class EmployeePhotoImagesController {
  constructor(
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
  ) {}

  @Get(':publicId/:version')
  @AllowAnonymous()
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Read a privately stored Employee Photo',
    description:
      'Serves a normalized JPEG only when the request includes a valid, short-lived HAMS read grant. The grant is a bearer credential; the byte request does not send a session cookie.',
  })
  @ApiResponse({ status: 200, description: 'Employee Photo bytes' })
  @ApiResponse({ status: 404, description: 'Grant or image was not found' })
  @ApiResponse({
    status: 503,
    description: 'Local image storage is unavailable',
  })
  async read(
    @Param('publicId') publicId: string,
    @Param('version') versionPath: string,
    @Query('expiresAt') expiresAtValue: unknown,
    @Query('signature') signature: unknown,
  ): Promise<StreamableFile> {
    const versionMatch = /^v([1-9]\d*)\.jpg$/.exec(versionPath);
    if (
      !/^hams-employee-photo-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        publicId,
      ) ||
      !versionMatch ||
      typeof expiresAtValue !== 'string' ||
      !/^\d{1,12}$/.test(expiresAtValue) ||
      typeof signature !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)
    ) {
      throw new NotFoundException();
    }

    const expiresAtSeconds = Number(expiresAtValue);
    if (!Number.isSafeInteger(expiresAtSeconds)) {
      throw new NotFoundException();
    }

    let storageContext: ReturnType<ImageStoragePort['getProviderContext']>;
    try {
      storageContext = this.storage.getProviderContext();
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_UNAVAILABLE',
        message: 'The image is temporarily unavailable',
      });
    }
    if (
      storageContext.provider !== 'local' ||
      !isLocalImageStoragePort(this.storage)
    ) {
      throw new NotFoundException();
    }

    const reference: ImageObjectReference = {
      publicId,
      storageContext,
      resourceType: 'image',
      deliveryType: 'authenticated',
      version: Number(versionMatch[1]),
    };
    const grant = {
      url:
        `/api/images/employees/${encodeURIComponent(publicId)}` +
        `/${versionPath}?expiresAt=${expiresAtValue}&signature=${signature}`,
      expiresAt: new Date(expiresAtSeconds * 1000),
    };

    try {
      const image = await this.storage.openPrivateEmployeePhoto(
        reference,
        grant,
      );
      return new StreamableFile(image.stream, {
        type: 'image/jpeg',
        disposition: 'inline',
        length: image.bytes,
      });
    } catch (error) {
      if (error instanceof ImageStorageError && error.code === 'UNAVAILABLE') {
        throw new ServiceUnavailableException({
          code: 'IMAGE_READ_UNAVAILABLE',
          message: 'The image is temporarily unavailable',
        });
      }
      throw new NotFoundException();
    }
  }
}
