import { Module } from '@nestjs/common';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { PrismaService } from 'src/prisma.service';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [ImagesModule],
  controllers: [AssetController],
  providers: [AssetService, PrismaService],
})
export class AssetModule {}
