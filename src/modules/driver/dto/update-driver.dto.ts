import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateDriverDto } from './create-driver.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @ApiProperty({
    example: '68f0f8f0f8f0f8f0f8f0f8f0',
    description: 'Driver ID',
  })
  @IsNotEmpty({ message: 'Driver ID is required' })
  @IsString()
  id: string;
}
