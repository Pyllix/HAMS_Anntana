import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { AuthModule, AuthGuard } from '@thallesp/nestjs-better-auth';
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
import { SparePartsModule } from './spare-parts/spare-parts.module';
import { SparePartGroupModule } from './spare-part-group/spare-part-group.module';
import { RolesGuard } from './common/guards/roles.guard';

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
    SparePartsModule,
    SparePartGroupModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
