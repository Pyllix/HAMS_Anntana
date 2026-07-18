import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { AuthFeatureModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SectionsModule } from './sections/sections.module';
import { CompanyModule } from './company/company.module';
import { AssetTypeModule } from './asset-type/asset-type.module';
import { AssetStatusModule } from './asset-status/asset-status.module';
import { AvailabilitiesModule } from './availabilities/availabilities.module';
import { AssetModule } from './asset/asset.module';
import { AssetBorrowModule } from './asset-borrow/asset-borrow.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    AuthFeatureModule,
    UsersModule,
    SectionsModule,
    CompanyModule,
    AssetTypeModule,
    AssetStatusModule,
    AvailabilitiesModule,
    AssetModule,
    AssetBorrowModule,
  ],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
