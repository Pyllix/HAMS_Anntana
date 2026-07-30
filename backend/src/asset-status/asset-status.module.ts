import { Module } from '@nestjs/common';
import { AssetStatusService } from './asset-status.service';
import { AssetStatusController } from './asset-status.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AssetStatusController],
  providers: [AssetStatusService, PrismaService],
})
export class AssetStatusModule {}
