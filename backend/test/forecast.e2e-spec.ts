import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import { PrismaService } from '../src/prisma.service';
import { ForecastController } from '../src/forecast/forecast.controller';
import { FORECAST_SETTINGS } from '../src/forecast/forecast-settings';
import { ForecastService } from '../src/forecast/forecast.service';
import request from 'supertest';

describe('GET /forecast/expenses', () => {
  let app: INestApplication;
  const mockPrismaService = {
    section: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [
        ForecastService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: FORECAST_SETTINGS,
          useValue: {
            enabled: false,
            apiKey: 'configured-but-disabled-key',
            timeoutMs: 30000,
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        new Error('disabled forecasting must not call an external provider'),
      );
    mockPrismaService.section.findMany.mockResolvedValue([
      { id: 'sec-1', name: 'Radiology', code: 'RAD' },
    ]);
    mockPrismaService.$queryRaw
      .mockResolvedValueOnce([
        {
          month: '2026-05',
          section_id: 'sec-1',
          section_name: 'Radiology',
          total_cost: 20000,
          repairs_cost: 15000,
          acquisitions_cost: 5000,
        },
        {
          month: '2026-06',
          section_id: 'sec-1',
          section_name: 'Radiology',
          total_cost: 25000,
          repairs_cost: 20000,
          acquisitions_cost: 5000,
        },
        {
          month: '2026-07',
          section_id: 'sec-1',
          section_name: 'Radiology',
          total_cost: 30000,
          repairs_cost: 25000,
          acquisitions_cost: 5000,
        },
      ])
      .mockResolvedValueOnce([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns history with a disabled status and makes no Gemini request', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/forecast/expenses?sectionId=all&months=6')
      .expect(200);

    expect(response.body).toMatchObject({
      forecast_status: 'disabled',
      has_sufficient_data: true,
      historical_data_count: 3,
      history: [{ date: '2026-05' }, { date: '2026-06' }, { date: '2026-07' }],
      ensemble: [],
      asset_lifespan: { total_active_assets: 0 },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
