import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { SupportStatus } from 'src/common/enums/support/support.enum';

export class UpdateSupportDto {
  @ApiPropertyOptional({
    enum: SupportStatus,
    example: SupportStatus.RESOLVED,
  })
  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;
}
