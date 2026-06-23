import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetLostDto {
    @ApiProperty({
        example: '2024-06-01T00:00:00.000Z',
        description: 'วันที่พบว่าครุภัณฑ์สูญหาย',
    })
    @IsDateString()
    @IsNotEmpty()
    discoveredAt: string;

    @ApiProperty({
        example: 'ห้อง ICU ชั้น 3',
        description: 'สถานที่ที่พบครุภัณฑ์ล่าสุดก่อนสูญหาย',
    })
    @IsString()
    @IsNotEmpty()
    lastSeenLocation: string;

    @ApiProperty({
        example: 'ไม่พบครุภัณฑ์หลังการย้ายห้อง สันนิษฐานว่าถูกนำออกโดยไม่ได้รับอนุญาต',
        description: 'รายละเอียดหรือสาเหตุของการสูญหาย',
    })
    @IsString()
    @IsNotEmpty()
    reason: string;
}
