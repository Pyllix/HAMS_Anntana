import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { IMAGE_STORAGE } from './image-storage.port';
import { IMAGE_CLOCK } from './image-clock.port';
import { ImageNoStoreMiddleware } from './image-no-store.middleware';
import { ImageUploadService } from './image-upload.service';
import { ImageUploadsController } from './image-uploads.controller';
import { ImageAttachmentService } from './image-attachment.service';
import { ImageReadService } from './image-read.service';
import { ImageCleanupService } from './image-cleanup.service';
import { runtimeConfig } from '../common/config/bootstrap-config';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter';
import { PublicAssetImagesController } from './public-asset-images.controller';

@Module({
  controllers: [ImageUploadsController, PublicAssetImagesController],
  providers: [
    PrismaService,
    ImageUploadService,
    ImageAttachmentService,
    ImageReadService,
    ImageCleanupService,
    {
      provide: IMAGE_STORAGE,
      useFactory: () =>
        runtimeConfig.images.provider === 'local'
          ? new LocalFilesystemStorageAdapter(runtimeConfig.images)
          : new CloudinaryStorageAdapter(),
    },
    { provide: IMAGE_CLOCK, useValue: { now: () => new Date() } },
  ],
  exports: [ImageAttachmentService, ImageReadService, ImageCleanupService],
})
export class ImagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ImageNoStoreMiddleware).forRoutes(ImageUploadsController, {
      path: 'users/:id/photo',
      method: RequestMethod.GET,
    });
  }
}
