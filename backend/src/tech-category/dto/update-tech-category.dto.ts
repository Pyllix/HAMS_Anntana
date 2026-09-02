import { PartialType } from '@nestjs/swagger';
import { CreateTechCategoryDto } from './create-tech-category.dto';

export class UpdateTechCategoryDto extends PartialType(CreateTechCategoryDto) {}
