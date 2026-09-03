import { PartialType } from '@nestjs/swagger';
import { CreateSparePartGroupDto } from './create-spare-part-group.dto';

export class UpdateSparePartGroupDto extends PartialType(CreateSparePartGroupDto) {}
