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
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IMAGE_STORAGE,
  ImageStorageError,
  type ImageObjectReference,
  type ImageStoragePort,
  isLocalImageStoragePort,
} from './image-storage.port';
import {
  EmployeePhotoImageReadParamsDto,
  EmployeePhotoImageReadQueryDto,
} from './dto/employee-photo-image-read.dto';
import {
  buildEmployeePhotoReadGrantUrl,
  EMPLOYEE_PHOTO_VERSION_PATH_PATTERN,
} from './employee-photo-read-grant';

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
  @ApiResponse({ status: 400, description: 'Invalid image read grant format' })
  @ApiResponse({ status: 404, description: 'Grant or image was not found' })
  @ApiResponse({
    status: 503,
    description: 'Local image storage is unavailable',
  })
  @ApiParam({ name: 'publicId', type: String })
  @ApiParam({ name: 'version', type: String })
  @ApiQuery({ name: 'expiresAt', type: String })
  @ApiQuery({ name: 'signature', type: String })
  async read(
    @Param() params: EmployeePhotoImageReadParamsDto,
    @Query() query: EmployeePhotoImageReadQueryDto,
  ): Promise<StreamableFile> {
    const { publicId, version: versionPath } = params;
    const { expiresAt: expiresAtValue, signature } = query;
    const versionMatch = EMPLOYEE_PHOTO_VERSION_PATH_PATTERN.exec(versionPath);
    if (!versionMatch) throw new NotFoundException();

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
    if (!isLocalImageStoragePort(this.storage, storageContext)) {
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
      url: buildEmployeePhotoReadGrantUrl({
        publicId,
        version: Number(versionMatch[1]),
        expiresAtSeconds,
        signature,
      }),
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
