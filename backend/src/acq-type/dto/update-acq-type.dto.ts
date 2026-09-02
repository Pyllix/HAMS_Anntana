import { PartialType } from '@nestjs/swagger';
import { CreateAcqTypeDto } from './create-acq-type.dto';

export class UpdateAcqTypeDto extends PartialType(CreateAcqTypeDto) {}
