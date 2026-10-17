import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TaskPriority } from '../task-priority.enum';
import { TaskStatus } from '../task-status.enum';

export const TASK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'title',
  'status',
  'priority',
] as const;

export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export class ListTasksQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '123e4567-e89b-42d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ enum: TASK_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sortBy: TaskSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
