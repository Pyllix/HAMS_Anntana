import { PartialType } from '@nestjs/swagger';
import { CreateCauseDto } from './create-cause.dto';

export class UpdateCauseDto extends PartialType(CreateCauseDto) {}
