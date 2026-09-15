import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

export class GetCompanyDriversQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of records per page',
    default: 10,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    example: 'John',
    description:
      'Search by full name, email, phone number, license number, or vehicle registration number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'All',
    description:
      'Filter by driver status (All, PENDING_APPROVAL, ACTIVE, INACTIVE, REJECTED, ON_RIDE, OFF_DUTY, ON_CALL)',
    enum: ['All', ...Object.values(DriverStatus)],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'Sedan',
    description: 'Filter by vehicle type',
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;
}
