import {
    IsString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsDateString,
    IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
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
    })
    @IsString()
    @IsOptional()
    serialNo?: string;

    @ApiProperty({
        example: '53202',
        description: 'GMDN Code',
    })
    @IsString()
    @IsOptional()
    gmdn?: string;

    @ApiProperty({
        example: '1000',
        description: 'ราคาของครุภัณฑ์',
    })
    @IsString()
    @IsNotEmpty()
    price: string;

    //   @ApiProperty({
    //     example: '2022-01-01',
    //     description: 'วันที่อนุมัติการจำหน่าย',
    //   })
    @IsDateString()
    @IsOptional()
    disposalApprovedDate?: string;

    @ApiProperty({
        example: '2022-01-01',
        description: 'วันที่หมดประกัน',
    })
    @IsDateString()
    @IsOptional()
    warrantyDate?: string;

    @ApiProperty({
        example: '1',
        description: 'ระดับความเสี่ยง',
    })
    @IsInt()
    @IsNotEmpty()
    riskLevel: number;

    @ApiProperty({
        example: 'true',
        description: 'เป็นเครื่องมือแพทย์หรือไม่',
    })
    @IsBoolean()
    @IsOptional()
    isMedicalDevice?: boolean;

    @ApiProperty({
        example: 'หมายเหตุ',
        description: 'หมายเหตุ',
    })
    @IsString()
    @IsOptional()
    remark?: string;

    @ApiProperty({
        example: 'https://example.com/image.jpg',
        description: 'URL ของรูปภาพครุภัณฑ์',
    })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({
        example: '2022-01-01',
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
        example: '1',
        description: 'รหัสประเภทครุภัณฑ์',
    })
    @IsInt()
    @IsNotEmpty()
    asset_type_id: number;

    @ApiProperty({
        example: '1',
        description: 'รหัสสถานะครุภัณฑ์',
    })
    @IsInt()
    @IsNotEmpty()
    asset_status_id: number;

    @ApiProperty({
        example: '1',
        description: 'รหัสสถานะความพร้อมใช้งาน',
    })
    @IsInt()
    @IsNotEmpty()
    availability_status_id: number;
}
