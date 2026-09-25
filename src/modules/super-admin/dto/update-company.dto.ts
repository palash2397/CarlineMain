import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty({
    example: '6aa8ee8df20e855656388cc7',
    description:
      'Company MongoDB _id or Company ID (CMP-xxxx) of the company to update',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  id: string;
}
