import { PartialType } from '@nestjs/swagger';
import { CreateAssetBorrowDto } from './create-asset-borrow.dto';

export class UpdateAssetBorrowDto extends PartialType(CreateAssetBorrowDto) {}
