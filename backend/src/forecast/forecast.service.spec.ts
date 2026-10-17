import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { PrismaService } from 'src/prisma.service';
import { FORECAST_SETTINGS } from './forecast-settings';

describe('ForecastService', () => {
  let service: ForecastService;

  const mockPrismaService = {
    section: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const forecastSettings = {
    enabled: false,
    apiKey: 'test-gemini-key',
    model: undefined as string | undefined,
    timeoutMs: 30000,
  };

  beforeEach(async () => {
    Object.assign(forecastSettings, {
      enabled: false,
      apiKey: 'test-gemini-key',
      model: undefined,
      timeoutMs: 30000,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FORECAST_SETTINGS, useValue: forecastSettings },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getExpenseForecast', () => {
    it('should return fallback when historical data count is less than 3', async () => {
      forecastSettings.enabled = true;
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 10000,
            repairs_cost: 10000,
            acquisitions_cost: 0,
          },
          {
            month: '2026-08',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 15000,
            repairs_cost: 15000,
            acquisitions_cost: 0,
          },
        ]) // combined expenses (< 3 months)
        .mockResolvedValueOnce([]); // asset expiry

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.has_sufficient_data).toBe(false);
      expect(result.forecast_status).toBe('insufficient_data');
      expect(result.source).toBe('fallback');
      expect(result.ensemble).toEqual([]);
      expect(result.message).toContain('ข้อมูลในอดีตมีน้อยเกินไป');
    });

    it('should calculate forecast and return response when historical data is sufficient', async () => {
      forecastSettings.enabled = true;
      const forecasts = [
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
      ].map((date, index) => ({
        date,
        repairs: 40000 + index * 2000,
        acquisitions: 5000,
        total: 45000 + index * 2000,
        lower_bound: 40000 + index * 2000,
        upper_bound: 50000 + index * 2000,
      }));
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ forecasts }) }] } },
            ],
          }),
          { status: 200 },
        ),
      );

      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-05',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 20000,
            repairs_cost: 15000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-06',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 25000,
            repairs_cost: 20000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 30000,
            repairs_cost: 25000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-08',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 35000,
            repairs_cost: 30000,
            acquisitions_cost: 5000,
          },
        ]) // combined expenses (4 months)
        .mockResolvedValueOnce([]); // asset expiry

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.has_sufficient_data).toBe(true);
      expect(result.forecast_status).toBe('available');
      expect(result.history).toHaveLength(4);
      expect(result.prediction_length).toBe(6);
      expect(result.ensemble).toHaveLength(6);
      expect(result.ensemble[0]).toHaveProperty('date');
      expect(result.ensemble[0]).toHaveProperty('forecast');
      expect(result.ensemble[0]).toHaveProperty('lower_bound');
      expect(result.ensemble[0]).toHaveProperty('upper_bound');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('keeps expense history and asset lifespan available without outbound Gemini requests when disabled', async () => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('unexpected outbound request'));
      const assetRow = {
        asset_id: 'asset-1',
        name: 'Analyzer',
        model: 'A1',
        noid: null,
        type_id: 1,
        type_name: 'Medical equipment',
        useful_life: 5,
        receive_date: '2010-01-01',
        expiry_date: '2015-01-01',
        age_years: 16,
        price: 100000,
        status_name: 'ใช้งานปกติ',
        section_id: 'sec-1',
        section_name: 'แผนกรังสีวิทยา',
        is_exceeded: true,
      };
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-05',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 20000,
            repairs_cost: 15000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-06',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 25000,
            repairs_cost: 20000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 30000,
            repairs_cost: 25000,
            acquisitions_cost: 5000,
          },
        ])
        .mockResolvedValueOnce([assetRow]);

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.forecast_status).toBe('disabled');
      expect(result.has_sufficient_data).toBe(true);
      expect(result.history).toHaveLength(3);
      expect(result.ensemble).toEqual([]);
      expect(result.asset_lifespan?.total_active_assets).toBe(1);
      expect(result.message).toContain('ปิด');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports provider failure without exposing provider details or hiding history', async () => {
      forecastSettings.enabled = true;
      forecastSettings.apiKey = 'test-gemini-key';
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('private provider response detail'));
      const loggerError = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      const assetRow = {
        asset_id: 'asset-1',
        name: 'Analyzer',
        model: 'A1',
        noid: null,
        type_id: 1,
        type_name: 'Medical equipment',
        useful_life: 5,
        receive_date: '2010-01-01',
        expiry_date: '2015-01-01',
        age_years: 16,
        price: 100000,
        status_name: 'ใช้งานปกติ',
        section_id: 'sec-1',
        section_name: 'แผนกรังสีวิทยา',
        is_exceeded: true,
      };
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-05',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 20000,
            repairs_cost: 15000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-06',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 25000,
            repairs_cost: 20000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 30000,
            repairs_cost: 25000,
            acquisitions_cost: 5000,
          },
        ])
        .mockResolvedValueOnce([assetRow]);

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.forecast_status).toBe('unavailable');
      expect(result.has_sufficient_data).toBe(true);
      expect(result.history).toHaveLength(3);
      expect(result.asset_lifespan?.total_active_assets).toBe(1);
      expect(result.ensemble).toEqual([]);
      expect(result.message).not.toContain('private provider response detail');
      expect(result.message).toContain('ไม่สามารถติดต่อ');
      expect(fetchMock).toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalled();
    });

    it('stops fallback requests when the total Gemini time budget expires', async () => {
      forecastSettings.enabled = true;
      forecastSettings.apiKey = 'test-gemini-key';
      forecastSettings.timeoutMs = 5000;
      let now = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const timeoutSignal = jest.spyOn(AbortSignal, 'timeout');
      jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementationOnce(() => {
          now = 6001;
          return Promise.reject(new Error('provider request failed'));
        });
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-05',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 20000,
            repairs_cost: 15000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-06',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 25000,
            repairs_cost: 20000,
            acquisitions_cost: 5000,
          },
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 30000,
            repairs_cost: 25000,
            acquisitions_cost: 5000,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.forecast_status).toBe('unavailable');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(timeoutSignal).toHaveBeenCalledWith(5000);
      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should filter by specific sectionId when provided', async () => {
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          {
            month: '2026-05',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 12000,
            repairs_cost: 12000,
            acquisitions_cost: 0,
          },
          {
            month: '2026-06',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 14000,
            repairs_cost: 14000,
            acquisitions_cost: 0,
          },
          {
            month: '2026-07',
            section_id: 'sec-1',
            section_name: 'แผนกรังสีวิทยา',
            total_cost: 16000,
            repairs_cost: 16000,
            acquisitions_cost: 0,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getExpenseForecast(3, 'sec-1');

      expect(result.section_id).toBe('sec-1');
      expect(result.section_name).toBe('แผนกรังสีวิทยา');
      expect(result.prediction_length).toBe(3);
    });
  });
});
