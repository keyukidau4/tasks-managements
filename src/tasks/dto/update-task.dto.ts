import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority } from '../task-priority.enum';
import { TaskStatus } from '../task-status.enum';

export class UpdateTaskDto {
  @ApiProperty({
    example: 3,
    minimum: 1,
    description: 'Current optimistic-lock version',
  })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({
    example: 'Prepare release',
    minLength: 1,
    maxLength: 200,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Verify the release checklist',
    maxLength: 10000,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({
    example: '123e4567-e89b-42d3-a456-426614174000',
    format: 'uuid',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    format: 'date-time',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;
}
