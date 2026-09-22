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
      expect(result.source).toBe('fallback');
      expect(result.ensemble).toEqual([]);
      expect(result.message).toContain('ข้อมูลในอดีตมีน้อยเกินไป');
    });

    it('should calculate forecast and return response when historical data is sufficient', async () => {
      jest.spyOn(service as any, 'generateGeminiForecasts').mockResolvedValue([
        { date: '2026-09', forecast: 40000, lower_bound: 35000, upper_bound: 45000 },
        { date: '2026-10', forecast: 42000, lower_bound: 37000, upper_bound: 47000 },
        { date: '2026-11', forecast: 44000, lower_bound: 39000, upper_bound: 49000 },
        { date: '2026-12', forecast: 46000, lower_bound: 41000, upper_bound: 51000 },
        { date: '2027-01', forecast: 48000, lower_bound: 43000, upper_bound: 53000 },
        { date: '2027-02', forecast: 50000, lower_bound: 45000, upper_bound: 55000 },
      ]);

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
