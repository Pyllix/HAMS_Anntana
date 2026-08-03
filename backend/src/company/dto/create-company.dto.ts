import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, MaxLength, IsOptional } from "class-validator";

export class CreateCompanyDto {
    @ApiProperty({ example: 'C001', description: 'รหัสบริษัท' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    code: string;

    @ApiProperty({ example: 'Company A', description: 'ชื่อบริษัท' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiPropertyOptional({ example: '1130', description: 'เบอร์โทรศัพท์ติดต่อ' })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    tel?: string;

    @ApiPropertyOptional({ example: '11/3 Moo 3 Rangsit', description: 'สถานที่ตั้ง' })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    address?: string;

    @ApiPropertyOptional({ example: '02-123-4567', description: 'เบอร์แฟกซ์สําหรับส่งเอกสารของบริษัท' })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    fax?: string;

    @ApiPropertyOptional({ example: 'IT', description: 'หมวดหมู่ทางธุรกิจของบริษัทคู่ค้า' })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    group?: string;

    @ApiPropertyOptional({ example: 'Main Building', description: 'หมายเหตุ' })
    @IsString()
    @IsOptional()
    remark?: string;
}
