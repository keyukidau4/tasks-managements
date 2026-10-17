import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TaskPriority } from '../task-priority.enum';
import { TaskStatus } from '../task-status.enum';

export class CreateTaskDto {
  @ApiProperty({ example: 'Prepare release', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'Verify the release checklist',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-42d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  @IsOptional()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;
}
