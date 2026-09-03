import { Module } from '@nestjs/common';
import { BudgetTypeService } from './budget-type.service';
import { BudgetTypeController } from './budget-type.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [BudgetTypeController],
  providers: [BudgetTypeService, PrismaService],
  exports: [BudgetTypeService],
})
export class BudgetTypeModule {}
