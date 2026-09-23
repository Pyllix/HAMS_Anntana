import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@thallesp/nestjs-better-auth';
import { ForecastService } from './forecast.service';
import { QueryExpenseForecastDto, ForecastResponseDto } from './dto';

@ApiTags('Forecast')
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Public()
  @Get('expenses')
  @ApiOperation({
    summary: 'พยากรณ์งบประมาณและค่าใช้จ่ายซ่อมบำรุงครุภัณฑ์ผ่าน AI API (รองรับการกรองรายแผนก)',
    description:
      'ดึงข้อมูลจากตาราง sparepart_txns และ asset แล้วส่งไปประมวลผลผ่าน Google Gemini AI (Pure Numerical Time-Series) สามารถเลือกดูรายแผนก หรือภาพรวมโรงพยาบาลได้',
  })
  @ApiOkResponse({
    description: 'ผลการพยากรณ์งบประมาณและประวัติค่าใช้จ่าย พร้อมการวิเคราะห์อายุขัยครุภัณฑ์',
    type: ForecastResponseDto,
  })
  async getExpenseForecast(
    @Query() query: QueryExpenseForecastDto,
    legacyMonths?: number,
  ): Promise<ForecastResponseDto> {
    // รองรับทั้งการเรียกผ่าน HTTP @Query() DTO และการเรียก positional arguments ใน Unit Test
    let sectionId: string | undefined;
    let months = 12;
    let historyMonths = 12;

    if (typeof query === 'string') {
      sectionId = query;
      months = typeof legacyMonths === 'number' ? legacyMonths : 12;
    } else if (query) {
      sectionId = query.sectionId;
      months = query.months !== undefined ? Number(query.months) : 12;
      historyMonths = query.historyMonths !== undefined ? Number(query.historyMonths) : 12;
    }

    return this.forecastService.getExpenseForecast(months, sectionId, historyMonths);
  }
}

