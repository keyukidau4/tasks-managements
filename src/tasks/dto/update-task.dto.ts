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
  @IsInt()
  @Min(1)
  version: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  dueDate?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;
}
