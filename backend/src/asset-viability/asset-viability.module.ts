import { Module } from '@nestjs/common';
import { AssetViabilityService } from './asset-viability.service';
import { AssetViabilityController } from './asset-viability.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AssetViabilityController],
  providers: [AssetViabilityService, PrismaService],
  exports: [AssetViabilityService],
})
export class AssetViabilityModule {}
