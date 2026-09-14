import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { StatusEnum } from 'src/common/enums/general/status-enum';

export class UpdateCompanyUserStatusDto {
  @ApiProperty({
    example: '6918698f1c6d5f7e3c9d9d9d',
    description: 'Id of the team member',
  })
  @IsString()
  id: string;

  @ApiProperty({
    example: StatusEnum.ACTIVE,
    description: 'Target status for the user (ACTIVE / INACTIVE)',
    enum: StatusEnum,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(StatusEnum, {
    message: 'Status must be ACTIVE or INACTIVE',
  })
  status: StatusEnum;
}
