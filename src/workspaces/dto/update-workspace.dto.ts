import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Engineering', minLength: 1, maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Product engineering workspace',
    maxLength: 5000,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
