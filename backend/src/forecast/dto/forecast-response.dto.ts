import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlySectionRankingDto {
  @ApiProperty({ description: 'ID ของแผนก (UUID)', example: 'sec-101' })
  id: string;

  @ApiProperty({ description: 'ชื่อแผนก', example: 'แผนกห้องผ่าตัด' })
  name: string;

  @ApiProperty({ description: 'ยอดค่าใช้จ่ายรวมของแผนกในเดือนนั้น (บาท)', example: 45000 })
  amount: number;

  @ApiProperty({ description: 'สัดส่วนเปอร์เซ็นต์เทียบกับค่าใช้จ่ายรวมทั้งโรงพยาบาล (%)', example: 28.5 })
  percentage: number;

  @ApiProperty({ description: 'อันดับการใช้งบประมาณประจำเดือน', example: 1 })
  rank: number;

  @ApiProperty({ description: 'ค่าใช้จ่ายซ่อมแซมและอะไหล่ (บาท)', example: 30000 })
  repairs: number;

  @ApiProperty({ description: 'ค่าจัดซื้อครุภัณฑ์ใหม่ (บาท)', example: 15000 })
  acquisitions: number;
}

export class MonthlyExpenseItemDto {
  @ApiProperty({ description: 'ปีและเดือน (รูปแบบ YYYY-MM)', example: '2026-08' })
  date: string;

  @ApiProperty({ description: 'ยอดค่าใช้จ่ายรวมประจำเดือน (บาท)', example: 85000 })
  cost: number;

  @ApiProperty({ description: 'ยอดค่าใช้จ่ายหมวดซ่อมแซมและอะไหล่ (บาท)', example: 55000 })
  repairs_cost: number;

  @ApiProperty({ description: 'ยอดค่าใช้จ่ายหมวดจัดซื้อครุภัณฑ์ใหม่ (บาท)', example: 30000 })
  acquisitions_cost: number;

  @ApiProperty({
    description: 'อันดับและสัดส่วนค่าใช้จ่ายรายแผนกในเดือนนั้น',
    type: () => [MonthlySectionRankingDto],
  })
  section_rankings: MonthlySectionRankingDto[];
}

export class ForecastItemDto {
  @ApiProperty({ description: 'ปีและเดือนที่พยากรณ์ (รูปแบบ YYYY-MM)', example: '2026-09' })
  date: string;

  @ApiProperty({ description: 'ยอดงบประมาณที่พยากรณ์ (บาท)', example: 68000 })
  forecast: number;

  @ApiPropertyOptional({ description: 'ขอบเขตล่างของงบประมาณ (Lower Bound)', example: 55000 })
  lower_bound?: number;

  @ApiPropertyOptional({ description: 'ขอบเขตบนของงบประมาณ (Upper Bound)', example: 82000 })
  upper_bound?: number;

  @ApiPropertyOptional({ description: 'ประมาณการค่าซ่อมแซมและอะไหล่ (บาท)', example: 45000 })
  repairs_cost?: number;

  @ApiPropertyOptional({ description: 'ประมาณการค่าจัดซื้อครุภัณฑ์ใหม่ (บาท)', example: 23000 })
  acquisitions_cost?: number;

  @ApiPropertyOptional({
    description: 'ประมาณการสัดส่วนและอันดับแผนก',
    type: () => [MonthlySectionRankingDto],
  })
  section_rankings?: MonthlySectionRankingDto[];

  @ApiPropertyOptional({ description: 'หมายเหตุเพิ่มเติมจากโมเดลพยากรณ์', example: 'พยากรณ์โดย Google Gemini AI 100%' })
  notes?: string;
}

export class ExpiringAssetItemDto {
  @ApiProperty({ description: 'รหัสครุภัณฑ์ (UUID)', example: 'ast-001' })
  id: string;

  @ApiProperty({ description: 'ชื่อครุภัณฑ์', example: 'เครื่องตรวจคลื่นหัวใจไฟฟ้า EKG' })
  name: string;

  @ApiProperty({ description: 'รุ่น / Model', example: 'MAC 2000' })
  model: string;

  @ApiPropertyOptional({ description: 'หมายเลขครุภัณฑ์ (NOID)', example: 'EQ-65-0012' })
  noid?: string;

  @ApiProperty({ description: 'ประเภทครุภัณฑ์', example: 'เครื่องมือทางการแพทย์' })
  asset_type: string;

  @ApiProperty({ description: 'อายุการใช้งานมาตรฐานตามเกณฑ์ (ปี)', example: 5 })
  useful_life: number;

  @ApiProperty({ description: 'วันที่ตรวจรับครุภัณฑ์ (YYYY-MM-DD)', example: '2019-03-15' })
  receive_date: string;

  @ApiProperty({ description: 'วันที่ครบอายุการใช้งานตามเกณฑ์ (YYYY-MM-DD)', example: '2024-03-15' })
  expiry_date: string;

  @ApiProperty({ description: 'อายุการใช้งานจริงปัจจุบัน (ปี)', example: 7.5 })
  age_years: number;

  @ApiProperty({ description: 'ราคาจัดซื้อเดิม (บาท)', example: 250000 })
  price: number;

  @ApiProperty({
    description: 'สถานะอายุขัย (EXCEEDED: เกินอายุขัย, EXPIRING_SOON: ใกล้ครบอายุขัย)',
    enum: ['EXCEEDED', 'EXPIRING_SOON'],
    example: 'EXCEEDED',
  })
  status: 'EXCEEDED' | 'EXPIRING_SOON';

  @ApiProperty({ description: 'ชื่อแผนกที่ครอบครองครุภัณฑ์', example: 'แผนกห้องฉุกเฉิน' })
  section_name: string;
}

export class AssetTypeLifespanSummaryDto {
  @ApiProperty({ description: 'รหัสประเภทครุภัณฑ์', example: 1 })
  type_id: number;

  @ApiProperty({ description: 'ชื่อประเภทครุภัณฑ์', example: 'เครื่องมือแพทย์' })
  type_name: string;

  @ApiProperty({ description: 'อายุการใช้งานมาตรฐาน (ปี)', example: 5 })
  useful_life: number;

  @ApiProperty({ description: 'จำนวนเครื่องที่ยังใช้งานอยู่ทั้งหมด', example: 350 })
  active_count: number;

  @ApiProperty({ description: 'จำนวนเครื่องที่ใช้งานเกินอายุขัย', example: 210 })
  exceeded_count: number;

  @ApiProperty({ description: 'มูลค่างบประมาณที่ต้องใช้ในการจัดซื้อทดแทน (บาท)', example: 15400000 })
  replacement_value: number;
}

export class AssetLifespanSummaryDto {
  @ApiProperty({ description: 'จำนวนครุภัณฑ์ที่ใช้งานอยู่ทั้งหมดในระบบ', example: 1550 })
  total_active_assets: number;

  @ApiProperty({ description: 'จำนวนครุภัณฑ์ที่ครบหรือเกินอายุขัยแล้ว', example: 1178 })
  exceeded_count: number;

  @ApiProperty({ description: 'สัดส่วนเปอร์เซ็นต์ของครุภัณฑ์ที่เกินอายุขัย (%)', example: 76.0 })
  exceeded_percentage: number;

  @ApiProperty({ description: 'งบประมาณรวมในการจัดหาครุภัณฑ์ทดแทนทั้งหมด (บาท)', example: 89300000 })
  total_replacement_budget: number;

  @ApiProperty({ description: 'ดัชนีปัจจัยความเสี่ยงค่าซ่อมบำรุงที่เพิ่มขึ้น', example: 1.15 })
  maintenance_risk_factor: number;

  @ApiProperty({
    description: 'สรุปการวิเคราะห์อายุขัยแยกตามประเภทครุภัณฑ์',
    type: () => [AssetTypeLifespanSummaryDto],
  })
  types_summary: AssetTypeLifespanSummaryDto[];

  @ApiProperty({
    description: 'รายการครุภัณฑ์วิกฤตที่เกินหรือใกล้ครบอายุขัย',
    type: () => [ExpiringAssetItemDto],
  })
  critical_assets: ExpiringAssetItemDto[];
}

export class SectionInfoDto {
  @ApiProperty({ description: 'ID ของแผนก (UUID)', example: 'sec-1' })
  id: string;

  @ApiProperty({ description: 'ชื่อแผนก', example: 'แผนกศัลยกรรม' })
  name: string;

  @ApiProperty({ description: 'รหัสย่อแผนก', example: 'SURG' })
  code: string;
}

export class TopSectionInfoDto {
  @ApiProperty({ description: 'ID ของแผนก (UUID)', example: 'sec-1' })
  id: string;

  @ApiProperty({ description: 'ชื่อแผนก', example: 'แผนกศัลยกรรม' })
  name: string;

  @ApiProperty({ description: 'ยอดค่าใช้จ่ายสะสมทั้งหมด (บาท)', example: 450000 })
  total_cost: number;
}

export class ModelForecastDetailDto {
  @ApiProperty({ description: 'ปีและเดือน (YYYY-MM)', example: '2026-09' })
  date: string;

  @ApiProperty({ description: 'ยอดพยากรณ์งบประมาณ (บาท)', example: 72000 })
  forecast: number;

  @ApiPropertyOptional({ description: 'ขอบเขตล่างของงบประมาณ', example: 58000 })
  lower_bound?: number;

  @ApiPropertyOptional({ description: 'ขอบเขตบนของงบประมาณ', example: 86000 })
  upper_bound?: number;
}

export class ForecastModelsDto {
  @ApiPropertyOptional({
    description: 'ผลการทำนายจาก Google Gemini AI',
    type: () => [ModelForecastDetailDto],
  })
  gemini?: ModelForecastDetailDto[];

  @ApiPropertyOptional({
    description: 'ผลการทำนายจาก Meta Prophet (ถ้ามี)',
    type: () => [ModelForecastDetailDto],
  })
  prophet?: ModelForecastDetailDto[];

  @ApiPropertyOptional({
    description: 'ผลการทำนายจาก Amazon Chronos-Bolt (ถ้ามี)',
    type: () => [ModelForecastDetailDto],
  })
  chronos?: ModelForecastDetailDto[];
}

export class ForecastResponseDto {
  @ApiProperty({
    description: 'แหล่งที่มาของผลการทำนาย (gemini_api หรือ fallback)',
    enum: ['gemini_api', 'fallback'],
    example: 'gemini_api',
  })
  source: 'gemini_api' | 'fallback';

  @ApiProperty({ description: 'รหัสแผนกที่เลือก หรือ "all" สำหรับภาพรวม', example: 'all' })
  section_id: string;

  @ApiProperty({ description: 'ชื่อแผนกที่เลือก', example: 'ทุกแผนก (ภาพรวมทั้งโรงพยาบาล)' })
  section_name: string;

  @ApiProperty({ description: 'ข้อมูลในอดีตเพียงพอสำหรับการพยากรณ์หรือไม่ (>= 3 เดือน)', example: true })
  has_sufficient_data: boolean;

  @ApiProperty({ description: 'จำนวนเดือนของข้อมูลประวัติในอดีต', example: 12 })
  historical_data_count: number;

  @ApiProperty({ description: 'จำนวนเดือนที่พยากรณ์ล่วงหน้า', example: 12 })
  prediction_length: number;

  @ApiPropertyOptional({ description: 'ข้อความแจ้งเตือนหรือคำอธิบายสถานะ', example: 'พยากรณ์สำเร็จ' })
  message?: string;

  @ApiProperty({ description: 'สถานะการทำ Data Masking ข้อมูลอ่อนไหวก่อนส่ง AI', example: false })
  is_data_masked: boolean;

  @ApiProperty({
    description: 'ประวัติค่าใช้จ่ายจริงรายเดือนย้อนหลัง',
    type: () => [MonthlyExpenseItemDto],
  })
  history: MonthlyExpenseItemDto[];

  @ApiPropertyOptional({
    description: 'รายชื่อแผนกทั้งหมดในระบบ',
    type: () => [SectionInfoDto],
  })
  sections?: SectionInfoDto[];

  @ApiPropertyOptional({
    description: 'อันดับแผนกที่มีค่าใช้จ่ายสะสมสูงสุด',
    type: () => [TopSectionInfoDto],
  })
  top_sections?: TopSectionInfoDto[];

  @ApiProperty({
    description: 'ผลลัพธ์แยกตามรายโมเดล AI',
    type: () => ForecastModelsDto,
  })
  models: ForecastModelsDto;

  @ApiProperty({
    description: 'ชุดข้อมูลพยากรณ์งบประมาณล่วงหน้ารวม (Ensemble Forecast Series)',
    type: () => [ForecastItemDto],
  })
  ensemble: ForecastItemDto[];

  @ApiPropertyOptional({
    description: 'สรุปการวิเคราะห์และวางแผนงบประมาณตามอายุขัยครุภัณฑ์ (Asset Lifespan Budget Planning)',
    type: () => AssetLifespanSummaryDto,
  })
  asset_lifespan?: AssetLifespanSummaryDto;
}

