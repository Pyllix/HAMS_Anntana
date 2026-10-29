import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';
import { PrismaService } from 'src/prisma.service';
import { runtimeConfig } from '../common/config/bootstrap-config';
import { FORECAST_SETTINGS, loadForecastSettings } from './forecast-settings';

@Module({
  controllers: [ForecastController],
  providers: [
    ForecastService,
    PrismaService,
    {
      provide: FORECAST_SETTINGS,
      useValue: loadForecastSettings(
        process.env,
        runtimeConfig.server.installationMode,
      ),
    },
  ],
  exports: [ForecastService],
})
export class ForecastModule {}
