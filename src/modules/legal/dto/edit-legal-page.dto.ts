import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// A partial edit of a page that already exists. Only the fields that are sent
// are changed, so the app can update the image alone.
export class EditLegalPageDto {
  @ApiPropertyOptional({
    example: 'Privacy Policy',
    description: 'Heading shown on top of the page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example:
      'This Privacy Policy describes our policies on the collection, use and disclosure of your information when you use the service.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/privacy-policy.png',
    description: 'Banner image of the page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;
}
