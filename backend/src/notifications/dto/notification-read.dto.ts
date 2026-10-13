import { ApiProperty } from '@nestjs/swagger';

export class EmptyNotificationRequestDto {}

export class NotificationReadAllResponseDto {
  @ApiProperty({ minimum: 0 })
  readonly updatedCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly readAt!: Date | null;
}
