import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Inject } from '@nestjs/common';
import {
  IMAGE_STORAGE,
  ImageStorageError,
  type ImageStoragePort,
  isLocalImageStoragePort,
} from './image-storage.port';

@Controller('images/assets')
export class PublicAssetImagesController {
  constructor(
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStoragePort,
  ) {}

  @Get(':publicId/:version')
  @AllowAnonymous()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async read(
    @Param('publicId') publicId: string,
    @Param('version') versionPath: string,
  ): Promise<StreamableFile> {
    const versionMatch = /^v([1-9]\d*)\.jpg$/.exec(versionPath);
    if (!versionMatch || !/^hams-asset-image-[0-9a-f-]{36}$/i.test(publicId)) {
      throw new NotFoundException();
    }

    let context: ReturnType<ImageStoragePort['getProviderContext']>;
    try {
      context = this.storage.getProviderContext();
    } catch {
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_UNAVAILABLE',
        message: 'The image is temporarily unavailable',
      });
    }
    if (
      context.provider !== 'local' ||
      !isLocalImageStoragePort(this.storage)
    ) {
      throw new NotFoundException();
    }

    try {
      const image = await this.storage.openPublicAsset({
        publicId,
        storageContext: context,
        resourceType: 'image',
        deliveryType: 'upload',
        version: Number(versionMatch[1]),
      });
      return new StreamableFile(image.stream, {
        type: 'image/jpeg',
        disposition: 'inline',
        length: image.bytes,
      });
    } catch (error) {
      if (
        error instanceof ImageStorageError &&
        error.code === 'OBJECT_NOT_FOUND'
      ) {
        throw new NotFoundException();
      }
      throw new ServiceUnavailableException({
        code: 'IMAGE_READ_UNAVAILABLE',
        message: 'The image is temporarily unavailable',
      });
    }
  }
}
