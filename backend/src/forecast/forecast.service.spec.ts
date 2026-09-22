import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { PrismaService } from 'src/prisma.service';

describe('ForecastService', () => {
  let service: ForecastService;
  let prisma: PrismaService;

  const mockPrismaService = {
    section: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getExpenseForecast', () => {
    it('should return fallback when historical data count is less than 3', async () => {
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([]) // top sections
        .mockResolvedValueOnce([
          { month: '2026-07', total_cost: 10000 },
          { month: '2026-08', total_cost: 15000 },
        ]); // monthly expenses (< 3 months)

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.has_sufficient_data).toBe(false);
      expect(result.source).toBe('fallback');
      expect(result.ensemble).toEqual([]);
      expect(result.message).toContain('ข้อมูลในอดีตมีน้อยเกินไป');
    });

    it('should calculate forecast and return response when historical data is sufficient', async () => {
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([
          { id: 'sec-1', name: 'แผนกรังสีวิทยา', total_cost: 150000 },
        ]) // top sections
        .mockResolvedValueOnce([
          { month: '2026-05', total_cost: 20000 },
          { month: '2026-06', total_cost: 25000 },
          { month: '2026-07', total_cost: 30000 },
          { month: '2026-08', total_cost: 35000 },
        ]); // monthly expenses (4 months)

      const result = await service.getExpenseForecast(6, 'all');

      expect(result.has_sufficient_data).toBe(true);
      expect(result.history).toHaveLength(4);
      expect(result.prediction_length).toBe(6);
      expect(result.ensemble).toHaveLength(6);
      expect(result.ensemble[0]).toHaveProperty('date');
      expect(result.ensemble[0]).toHaveProperty('forecast');
      expect(result.ensemble[0]).toHaveProperty('lower_bound');
      expect(result.ensemble[0]).toHaveProperty('upper_bound');
    });

    it('should filter by specific sectionId when provided', async () => {
      mockPrismaService.section.findMany.mockResolvedValue([
        { id: 'sec-1', name: 'แผนกรังสีวิทยา', code: 'RAD' },
      ]);
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([]) // top sections
        .mockResolvedValueOnce([
          { month: '2026-05', total_cost: 12000 },
          { month: '2026-06', total_cost: 14000 },
          { month: '2026-07', total_cost: 16000 },
        ]);

      const result = await service.getExpenseForecast(3, 'sec-1');

      expect(result.section_id).toBe('sec-1');
      expect(result.section_name).toBe('แผนกรังสีวิทยา');
      expect(result.prediction_length).toBe(3);
    });
  });
});
