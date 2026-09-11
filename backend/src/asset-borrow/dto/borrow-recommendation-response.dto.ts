import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BorrowRecommendationCandidateDto {
  @ApiProperty({ example: 'uuid-asset-3', description: 'Asset UUID' })
  assetId: string;

  @ApiPropertyOptional({ example: 'MD-67-003', nullable: true, description: 'Asset inventory number' })
  noid: string | null;

  @ApiProperty({ example: 'เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน' })
  name: string;

  @ApiProperty({ example: 'Puritan Bennett 840' })
  model: string;

  @ApiPropertyOptional({ example: 'SN-PB840-003', nullable: true })
  serialNo: string | null;

  @ApiPropertyOptional({ example: 'ศูนย์เครื่องมือแพทย์', nullable: true })
  sectionName: string | null;

  @ApiPropertyOptional({ example: 'https://storage.../image.jpg', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 0.0, description: 'Cumulative active usage days within the last 90 days' })
  usageDays90d: number;

  @ApiProperty({ example: 45.2, description: 'Days rested in storage since last return or acquisition' })
  idleDays: number;

  @ApiProperty({ example: 0, description: 'Number of borrow transactions in the last 90 days' })
  borrowCount90d: number;

  @ApiProperty({ example: true, description: 'True if this is the top recommended asset in the pool' })
  isRecommended: boolean;

  @ApiProperty({
    example: '🌟 แนะนำเครื่องนี้: ครุภัณฑ์ใหม่พร้อมใช้งาน ยังไม่มีประวัติการยืมในรอบ 90 วัน',
    description: 'Human-readable explainable reason in Thai',
  })
  recommendationReason: string;
}

export class BorrowRecommendationsResponseDto {
  @ApiPropertyOptional({ example: 'Puritan Bennett 840' })
  model?: string;

  @ApiPropertyOptional({ example: 1 })
  equipmentTypeId?: number;

  @ApiProperty({ example: 3, description: 'Total available and normal assets evaluated in this model' })
  totalAvailable: number;

  @ApiPropertyOptional({ example: 'uuid-asset-3', nullable: true })
  recommendedAssetId: string | null;

  @ApiProperty({ type: [BorrowRecommendationCandidateDto] })
  candidates: BorrowRecommendationCandidateDto[];
}

export class SwapRecommendedAssetDto {
  @ApiProperty({ example: 'uuid-asset-3' })
  id: string;

  @ApiPropertyOptional({ example: 'MD-67-003', nullable: true })
  noid: string | null;

  @ApiProperty({ example: 'เครื่องช่วยหายใจชนิดควบคุมด้วยปริมาตรและความดัน' })
  name: string;

  @ApiProperty({ example: 'Puritan Bennett 840' })
  model: string;

  @ApiProperty({ example: 0.0 })
  usageDays90d: number;

  @ApiProperty({ example: 45.2 })
  idleDays: number;

  @ApiProperty({ example: 26.0, description: 'Difference in 90-day usage days compared to the selected asset' })
  daysUsageDifference: number;

  @ApiProperty({
    example:
      '💡 พบเครื่องรุ่นเดียวกัน (หมายเลข MD-67-003) จอดพักมาแล้ว 45 วัน (ผ่านการใช้งานน้อยกว่าเครื่องนี้ 26 วัน) คุณต้องการสลับใช้เครื่องที่แนะนำเพื่อกระจายการใช้งานหรือไม่?',
    description: 'Thai nudge message for the alert banner / dialog',
  })
  nudgeReason: string;
}

export class SwapCheckSelectedAssetDto {
  @ApiProperty({ example: 'uuid-asset-1' })
  id: string;

  @ApiPropertyOptional({ example: 'MD-67-001', nullable: true })
  noid: string | null;

  @ApiProperty({ example: 26.0 })
  usageDays90d: number;

  @ApiProperty({ example: 1.5 })
  idleDays: number;
}

export class SwapCheckResponseDto {
  @ApiProperty({ type: SwapCheckSelectedAssetDto })
  selectedAsset: SwapCheckSelectedAssetDto;

  @ApiProperty({ example: true, description: 'True if a significantly more rested alternative exists' })
  hasBetterAlternative: boolean;

  @ApiPropertyOptional({ type: SwapRecommendedAssetDto, nullable: true })
  recommendedAsset?: SwapRecommendedAssetDto | null;
}
