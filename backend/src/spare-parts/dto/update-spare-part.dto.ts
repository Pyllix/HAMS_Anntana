import { PartialType } from '@nestjs/swagger';
import { CreateSparepartDto } from './create-spare-part.dto';

export class UpdateSparepartDto extends PartialType(CreateSparepartDto) {}
