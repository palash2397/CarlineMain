import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCompanyUserStatusDto {
  @ApiProperty({
    example: '6918698f1c6d5f7e3c9d9d9d',
    description: 'Id of the team member',
  })
  @IsString()
  id: string;

  @ApiProperty({
    example: 'Active',
    description: 'Target status for the user (Active / Inactive)',
    enum: ['Active', 'Inactive'],
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(['Active', 'Inactive'], {
    message: 'Status must be Active or Inactive',
  })
  status: string;
}
