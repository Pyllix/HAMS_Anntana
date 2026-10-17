import { Test, TestingModule } from '@nestjs/testing';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';

describe('ForecastController', () => {
  let controller: ForecastController;

  const mockForecastService = {
    getExpenseForecast: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [{ provide: ForecastService, useValue: mockForecastService }],
    }).compile();

    controller = module.get<ForecastController>(ForecastController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getExpenseForecast', () => {
    it('should call forecastService.getExpenseForecast with default parameters', async () => {
      const mockResult: any = {
        source: 'gemini_api',
        section_id: 'all',
        section_name: 'ทุกแผนก (ภาพรวมทั้งโรงพยาบาล)',
        has_sufficient_data: true,
        historical_data_count: 6,
        prediction_length: 6,
        history: [],
        ensemble: [],
      };
      mockForecastService.getExpenseForecast.mockResolvedValue(mockResult);

      const result = await controller.getExpenseForecast({
        sectionId: 'all',
        months: 6,
      });

      expect(mockForecastService.getExpenseForecast).toHaveBeenCalledWith(
        6,
        'all',
        12,
      );
      expect(result).toEqual(mockResult);
    });

    it('should pass sectionId and custom months to forecastService', async () => {
      const mockResult: any = {
        source: 'gemini_api',
        section_id: 'sec-101',
        section_name: 'แผนกห้องผ่าตัด',
        has_sufficient_data: true,
        historical_data_count: 6,
        prediction_length: 12,
        history: [],
        ensemble: [],
      };
      mockForecastService.getExpenseForecast.mockResolvedValue(mockResult);

      const result = await controller.getExpenseForecast({
        sectionId: 'sec-101',
        months: 12,
      });

      expect(mockForecastService.getExpenseForecast).toHaveBeenCalledWith(
        12,
        'sec-101',
        12,
      );
      expect(result).toEqual(mockResult);
    });

    it('passes the disabled state together with independent history and asset data', async () => {
      const mockResult = {
        forecast_status: 'disabled',
        source: 'fallback',
        section_id: 'all',
        section_name: 'ทุกแผนก',
        has_sufficient_data: true,
        historical_data_count: 4,
        prediction_length: 12,
        message: 'ปิดการพยากรณ์ด้วย Gemini',
        history: [{ date: '2026-07', cost: 10000 }],
        ensemble: [],
        asset_lifespan: { total_active_assets: 3 },
      };
      mockForecastService.getExpenseForecast.mockResolvedValue(mockResult);

      const result = await controller.getExpenseForecast({ sectionId: 'all' });

      expect(result).toMatchObject({
        forecast_status: 'disabled',
        history: [{ date: '2026-07', cost: 10000 }],
        ensemble: [],
        asset_lifespan: { total_active_assets: 3 },
      });
    });
  });
});
