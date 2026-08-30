import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับบันทึกรายการจำหน่ายครุภัณฑ์ (Disposal) ตาม hams_schema.dbml
 */
export class CreateAssetDisposalDto {
    @ApiProperty({
        example: 'DISP-2567-001',
        description: 'หมายเลขเอกสารการจำหน่าย',
    })
    @IsString()
    @IsNotEmpty()
    disposalDocNo: string;

    @ApiProperty({
        example: '2024-06-01T00:00:00.000Z',
        description: 'วันที่อนุมัติการจำหน่าย',
    })
    @IsDateString()
    @IsNotEmpty()
    approvedDate: string;
}
