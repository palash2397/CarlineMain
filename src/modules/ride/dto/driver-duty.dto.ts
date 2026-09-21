import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// Go online / Go offline button on the driver home screen.
export class DriverDutyDto {
  @ApiProperty({
    example: true,
    description: 'true = Go online (accept rides), false = Go offline',
  })
  @IsBoolean()
  isOnline: boolean;
}