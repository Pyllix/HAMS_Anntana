import {
    IsString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsDateString,
    IsUUID,
    IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RiskLevel, PmType, CalType } from '@prisma/client';

export class CreateAssetDto {
    @ApiProperty({
        example: 'EQ-2567-0001',
        description: 'หมายเลขครุภัณฑ์',
        required: false,
    })
    @IsString()
    @IsOptional()
    noid?: string;

    @ApiProperty({
        example: 'เครื่องวัดความดัน',
        description: 'ชื่อครุภัณฑ์',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: 'MC001',
        description: 'รุ่นครุภัณฑ์',
    })
    @IsString()
    @IsNotEmpty()
    model: string;

    @ApiProperty({
        example: '123456789012345',
        description: 'หมายเลขซีเรียลนัมเบอร์ของครุภัณฑ์',
        required: false,
    })
    @IsString()
    @IsOptional()
    serialNo?: string;

    @ApiProperty({
        example: 'เงินงบประมาณแผ่นดิน',
        description: 'ประเภทเงินทุน',
    })
    @IsString()
    @IsNotEmpty()
    budgetType: string;

    @ApiProperty({
        example: 'จัดซื้อ',
        description: 'ประเภทการได้รับมา',
    })
    @IsString()
    @IsNotEmpty()
    acqType: string;

    @ApiProperty({
        example: 'DOC-2567-001',
        description: 'เอกสารการได้รับมา',
    })
    @IsString()
    @IsNotEmpty()
    acqDoc: string;

    @ApiProperty({
        example: '1000',
        description: 'ราคาของครุภัณฑ์',
    })
    @IsString()
    @IsNotEmpty()
    price: string;

    @ApiProperty({
        example: '2028-01-01',
        description: 'วันที่หมดประกัน',
        required: false,
    })
    @IsString()
    @IsOptional()
    warrantyDate?: string;

    @ApiProperty({
        enum: PmType,
        example: PmType.IM,
        description: 'ประเภทการบำรุงรักษา (IM / EM)',
    })
    @IsEnum(PmType)
    @IsNotEmpty()
    pmType: PmType;

    @ApiProperty({
        example: 6,
        description: 'ความถี่การบำรุงรักษา (เดือน)',
        required: false,
    })
    @IsInt()
    @IsOptional()
    pmIntervalMonth?: number;

    @ApiProperty({
        enum: CalType,
        example: CalType.IC,
        description: 'ประเภทการสอบเทียบมาตรฐาน (IC / EC)',
    })
    @IsEnum(CalType)
    @IsNotEmpty()
    calType: CalType;

    @ApiProperty({
        example: 12,
        description: 'ความถี่การสอบเทียบมาตรฐาน (เดือน)',
        required: false,
    })
    @IsInt()
    @IsOptional()
    calIntervalMonth?: number;

    @ApiProperty({
        example: 1,
        description: 'รหัสประเภทเครื่องมือ',
        required: false,
    })
    @IsInt()
    @IsOptional()
    equipment_type_id?: number;

    @ApiProperty({
        enum: RiskLevel,
        example: RiskLevel.MEDIUM,
        description: 'ระดับความเสี่ยง',
    })
    @IsEnum(RiskLevel)
    @IsNotEmpty()
    riskLevel: RiskLevel;

    @ApiProperty({
        example: false,
        description: 'เป็นเครื่องมือพิเศษหรือไม่',
    })
    @IsBoolean()
    @IsOptional()
    isSpecial?: boolean;

    @ApiProperty({
        example: true,
        description: 'เป็นเครื่องมือสำรองหรือไม่',
    })
    @IsBoolean()
    @IsOptional()
    isBackup?: boolean;

    @ApiProperty({
        example: 'หมายเหตุ',
        description: 'หมายเหตุ',
        required: false,
    })
    @IsString()
    @IsOptional()
    remark?: string;

    @ApiProperty({
        example: 'https://example.com/image.jpg',
        description: 'URL ของรูปภาพครุภัณฑ์',
        required: false,
    })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({
        example: '2024-01-01',
        description: 'วันที่รับครุภัณฑ์',
    })
    @IsDateString()
    @IsNotEmpty()
    receivedDate: string;

    @ApiProperty({
        example: '9c05939c-956b-46f4-a4bd-f5dccc56df89',
        description: 'รหัสหน่วยงาน',
    })
    @IsUUID()
    @IsNotEmpty()
    section_id: string;

    @ApiProperty({
        example: '1db62371-a6ca-4176-9f1c-b19fc3a770e3',
        description: 'รหัสบริษัท',
    })
    @IsUUID()
    @IsNotEmpty()
    company_id: string;

    @ApiProperty({
        example: 1,
        description: 'รหัสประเภทครุภัณฑ์',
    })
    @IsInt()
    @IsNotEmpty()
    asset_type_id: number;

    @ApiProperty({
        example: 1,
        description: 'รหัสสถานะครุภัณฑ์',
    })
    @IsInt()
    @IsNotEmpty()
    asset_status_id: number;

    @ApiProperty({
        example: 1,
        description: 'รหัสสถานะความพร้อมใช้งาน',
        required: false,
    })
    @IsInt()
    @IsOptional()
    availability_status_id?: number;

    @ApiProperty({
        example: '9c05939c-956b-46f4-a4bd-f5dccc56df89',
        description: 'ผู้รับผิดชอบครุภัณฑ์ (User UUID)',
    })
    @IsUUID()
    @IsNotEmpty()
    owner_id: string;
}
