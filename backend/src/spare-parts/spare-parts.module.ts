import { Module } from '@nestjs/common';
import { SparePartsService } from './spare-parts.service';
import { SparePartsController } from './spare-parts.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SparePartsController],
  providers: [SparePartsService, PrismaService],
  exports: [SparePartsService],
})
export class SparePartsModule {}
