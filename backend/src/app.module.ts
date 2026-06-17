import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { AuthFeatureModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SectionsModule } from './sections/sections.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    AuthFeatureModule,
    UsersModule,
    SectionsModule,
  ],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule { }
