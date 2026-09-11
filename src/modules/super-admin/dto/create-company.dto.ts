import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCompanyDto {
  // --- Basic Information ---
  @ApiProperty({
    example: 'ABC Taxi Services Private Limited',
    description: 'Official legal name of the company',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  legalName: string;

  @ApiProperty({
    example: 'ABC Taxi',
    description: 'Customer facing display name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @ApiProperty({
    example: 'ABCTX',
    description: 'Unique company short code',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  companyCode: string;

  @ApiPropertyOptional({
    example: 'L-99283-IND',
    description: 'Registration or license number',
  })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Suspended', 'Inactive'],
    default: 'Active',
  })
  @IsOptional()
  @IsEnum(['Active', 'Suspended', 'Inactive'])
  status?: string;

  // --- Address Information ---
  @ApiPropertyOptional({
    example: '102 Royal Park Building',
    description: 'Street address',
  })
  @IsOptional()
  @IsString()
  streetAddress?: string;

  @ApiProperty({
    example: 'Indore',
    description: 'City',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({
    example: 'Madhya Pradesh',
    description: 'State / Province',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  state: string;

  @ApiPropertyOptional({
    example: '452001',
    description: 'ZIP / Postal Code',
  })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({
    example: 'India',
    description: 'Country',
    default: 'India',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: 'IST (UTC+5:30)',
    description: 'Timezone',
    default: 'IST (UTC+5:30)',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  // --- Primary Contact (Company Admin) ---
  @ApiProperty({
    example: 'John Doe',
    description: 'Primary contact person name (Company Admin)',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  primaryContactName: string;

  @ApiProperty({
    example: 'john@abctaxi.com',
    description: 'Primary contact email (Temporary password will be sent here)',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid primary contact email' })
  primaryContactEmail: string;

  @ApiProperty({
    example: '+91 9988776655',
    description: 'Primary contact phone number',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  primaryContactPhone: string;

  // --- Billing Information ---
  @ApiPropertyOptional({
    example: 'Accounts Dept',
    description: 'Billing contact person name',
  })
  @IsOptional()
  @IsString()
  billingContactName?: string;

  @ApiPropertyOptional({
    example: 'billing@abctaxi.com',
    description: 'Billing contact email',
  })
  @IsOptional()
  @IsString()
  billingEmail?: string;

  @ApiPropertyOptional({
    example: '+91 9000000000',
    description: 'Billing phone number',
  })
  @IsOptional()
  @IsString()
  billingPhone?: string;

  @ApiPropertyOptional({
    example: '102 Royal Park Building, Indore',
    description: 'Billing address',
  })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  // --- Branding ---
  @ApiPropertyOptional({
    example: '#E05326',
    description: 'Brand primary color hex code',
    default: '#E05326',
  })
  @IsOptional()
  @IsString()
  brandColor?: string;

  @ApiPropertyOptional({
    example: 'ABC Go',
    description: 'Display name override for driver/customer apps',
  })
  @IsOptional()
  @IsString()
  displayNameOverride?: string;

  // --- Document Details ---
  @ApiPropertyOptional({
    example: 'Business License',
    description: 'Document type (e.g. Business License, Tax Certificate, Insurance)',
  })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({
    example: 'License_2026.pdf',
    description: 'Document name / title',
  })
  @IsOptional()
  @IsString()
  documentName?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Issue date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({
    example: '2030-01-01',
    description: 'Expiry date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  // --- Upload Files ---
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Company Logo image (PNG, JPG, SVG, WEBP)',
  })
  @IsOptional()
  logo?: any;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Upload one or more verification document files (PDF, DOCX, PNG, JPG)',
  })
  @IsOptional()
  documents?: any[];
}
