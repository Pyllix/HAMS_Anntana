import { ApiProperty } from '@nestjs/swagger';
import { NotificationResourceType, NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: NotificationResourceType })
  resourceType!: NotificationResourceType;

  @ApiProperty()
  resourceId!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
