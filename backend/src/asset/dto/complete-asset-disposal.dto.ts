import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับอัปเดตระเบียนการจำหน่าย — ขั้นตอนที่ 2: จำหน่ายแล้ว (DISPOSED)
 * disposal_status_id ชี้ไปที่ AssetStatus table (row ที่มี code = 'DISPOSED')
 */
export class CompleteAssetDisposalDto {
    @ApiProperty({
        example: 4,
        description: 'รหัสสถานะการจำหน่ายจาก AssetStatus (code: DISPOSED)',
    })
    @IsInt()
    @IsNotEmpty()
    disposal_status_id: number;

    @ApiProperty({
        example: '2024-07-15T00:00:00.000Z',
        description: 'วันที่จำหน่ายสำเร็จ',
    })
    @IsDateString()
    @IsNotEmpty()
    disposedAt: string;

    @ApiProperty({
        example: 'จำหน่ายตามระเบียบพัสดุ เนื่องจากครุภัณฑ์ล้าสมัย',
        description: 'สาเหตุการจำหน่าย',
    })
    @IsString()
    @IsNotEmpty()
    disposalReason: string;

    @ApiProperty({
        example: 'ผ่านการอนุมัติจากผู้อำนวยการโรงพยาบาลเมื่อวันที่ 10/07/2024',
        description: 'หมายเหตุเพิ่มเติม (optional)',
        required: false,
    })
    @IsString()
    @IsOptional()
    remark?: string;
}
