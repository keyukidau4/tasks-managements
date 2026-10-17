import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'Website redesign',
    minLength: 1,
    maxLength: 100,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Refresh the public website',
    maxLength: 5000,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    format: 'date-time',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  dueDate?: string | null;
}
