import { PartialType } from '@nestjs/swagger';
import { CreateJobTypeDto } from './create-job-type.dto';

export class UpdateJobTypeDto extends PartialType(CreateJobTypeDto) {}
