import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAssetStatusDto {
    @ApiProperty({
        example: 3,
        description:
            'รหัสสถานะครุภัณฑ์จาก AssetStatus (เช่น Lost, Disposal) — Asset ไม่มีการลบข้อมูล ใช้การเปลี่ยนสถานะแทน',
    })
    @IsInt()
    @IsNotEmpty()
    asset_status_id: number;
}
