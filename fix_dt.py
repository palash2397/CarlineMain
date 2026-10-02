import re

with open('D:\\prakash\\ivr\\ivr-backend\\src\\modules\\ride\\dto\\create-recurring-ride.dto.ts', 'r') as f:
    content = f.read()

# Find and replace the startDate section
old = '''  @ApiPropertyOptional({
    example: '2026-10-01',
    description:
      'First day the series may run (pickup time is added by the backend)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;'''

new = '''  @ApiProperty({
    example: '2026-10-01',
    description:
      'First day the series may run (pickup time is added by the backend)',
  })
  @Type(() => Date)
  @IsDate()
  startDate: Date;'''

content = content.replace(old, new)

with open('D:\\prakash\\ivr\\ivr-backend\\src\\modules\\ride\\dto\\create-recurring-ride.dto.ts', 'w') as f:
    f.write(content)

print('DTO file updated')
