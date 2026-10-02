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

@Module({
  controllers: [ImageUploadsController],
  providers: [
    PrismaService,
    ImageUploadService,
    ImageAttachmentService,
    ImageReadService,
    CloudinaryStorageAdapter,
    { provide: IMAGE_STORAGE, useExisting: CloudinaryStorageAdapter },
    { provide: IMAGE_CLOCK, useValue: { now: () => new Date() } },
  ],
  exports: [ImageAttachmentService, ImageReadService],
})
export class ImagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ImageNoStoreMiddleware).forRoutes(ImageUploadsController, {
      path: 'users/:id/photo',
      method: RequestMethod.GET,
    });
  }
}
