import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website redesign', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Refresh the public website',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
