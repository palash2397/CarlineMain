import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';

import { RideLocationDto } from './ride-location.dto';

// Only pickup and dropoff (with their coordinates) come from the app. The
// backend calculates the distance, the ETA and every fare itself.
export class EstimateFareDto {
  @ApiProperty({
    type: RideLocationDto,
    example: {
      address: '742 Evergreen Terrace, San Francisco, CA',
      latitude: 37.7955,
      longitude: -122.3937,
    },
    description: 'Pickup location selected by the passenger',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup: RideLocationDto;

  @ApiProperty({
    type: RideLocationDto,
    example: {
      address: 'SFO Airport Terminal 2, San Francisco, CA',
      latitude: 37.6213,
      longitude: -122.379,
    },
    description: 'Dropoff location selected by the passenger',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RideLocationDto)
  dropoff: RideLocationDto;
}
