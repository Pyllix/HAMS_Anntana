import { ApiProperty } from '@nestjs/swagger';

export class EmptyNotificationRequestDto {}

export class NotificationReadAllResponseDto {
  @ApiProperty({ minimum: 0 })
  updatedCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;
}
