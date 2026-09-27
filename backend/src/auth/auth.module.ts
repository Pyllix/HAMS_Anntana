import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TwoFactorService } from './two-factor.service';
import { TrustedBrowserService } from './trusted-browser.service';
import { PreAuthService } from './pre-auth.service';
import { AdminStepUpService } from './admin-step-up.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    TwoFactorService,
    TrustedBrowserService,
    PreAuthService,
    AdminStepUpService,
  ],
  exports: [
    TwoFactorService,
    TrustedBrowserService,
    PreAuthService,
    AdminStepUpService,
  ],
})
export class AuthFeatureModule {}
