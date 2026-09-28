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

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Banner image of the page. Send the file as form-data in the image field, or a URL here on a JSON request. The current image is kept when both are left out.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;
}
