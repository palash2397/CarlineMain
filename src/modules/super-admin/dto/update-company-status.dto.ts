import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsMongoId } from 'class-validator';
import { CompanyStatus } from 'src/common/enums/companies/status-enum';

export class UpdateCompanyStatusDto {
  @ApiProperty({
    example: '68f3760b06c0d3ac7d6931c7',
    description: 'Company ID',
    required: true,
  })
  @IsNotEmpty()
  @IsMongoId()
  id: string;

  @ApiProperty({
    example: 'Active',
    enum: CompanyStatus,
    description: 'New company status',
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(CompanyStatus, {
    message: 'Status must be Active, Suspended, or Inactive',
  })
  status: CompanyStatus;
}
