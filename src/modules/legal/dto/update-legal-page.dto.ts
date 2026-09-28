import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLegalPageDto {
  @ApiPropertyOptional({
    example: 'Privacy Policy',
    description: 'Heading shown on top of the page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    example:
      'This Privacy Policy describes our policies on the collection, use and disclosure of your information when you use the service.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  content: string;
}
