import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับสร้างระเบียนการจำหน่าย — ขั้นตอนที่ 1: รอจำหน่าย (WAIT_DISPOSAL)
 */
export class CreateAssetDisposalDto {

    @ApiProperty({
        example: 'ครุภัณฑ์หมดอายุการใช้งาน ไม่คุ้มค่าในการซ่อมแซม',
        description: 'เหตุผลที่ต้องรอจำหน่าย',
    })
    @IsString()
    @IsNotEmpty()
    pendingReason: string;

    @ApiProperty({
        example: '2024-06-01T00:00:00.000Z',
        description: 'วันที่เริ่มรอจำหน่าย',
    })
    @IsDateString()
    @IsNotEmpty()
    pendingAt: string;
}
