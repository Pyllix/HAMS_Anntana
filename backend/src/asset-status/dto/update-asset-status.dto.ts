import { PartialType } from '@nestjs/swagger';
import { CreateAssetStatusDto } from './create-asset-status.dto';

export class UpdateAssetStatusDto extends PartialType(CreateAssetStatusDto) {}
