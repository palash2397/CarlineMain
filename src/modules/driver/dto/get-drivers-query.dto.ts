import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetDriversQueryDto {
  @ApiPropertyOptional({ default: 1, type: Number })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10, type: Number })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by full name, email, phone, or license number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['All', 'ACTIVE', 'INACTIVE', 'ON_RIDE', 'OFF_DUTY', 'ON_CALL'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by availability (e.g. Available, Unavailable, Off Duty)' })
  @IsOptional()
  @IsString()
  availability?: string;

  @ApiPropertyOptional({ description: 'Filter by dispatch priority (e.g. Normal, High, Low)' })
  @IsOptional()
  @IsString()
  dispatchPriority?: string;

  @ApiPropertyOptional({ description: 'Filter by license class' })
  @IsOptional()
  @IsString()
  licenseClass?: string;
}
