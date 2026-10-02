import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthFeatureModule } from '../auth/auth.module';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [AuthFeatureModule, ImagesModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
