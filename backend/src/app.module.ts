import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    UsersModule,
  ],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
