import { Module } from '@nestjs/common';
import { TechCategoryService } from './tech-category.service';
import { TechCategoryController } from './tech-category.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TechCategoryController],
  providers: [TechCategoryService, PrismaService],
  exports: [TechCategoryService],
})
export class TechCategoryModule {}
