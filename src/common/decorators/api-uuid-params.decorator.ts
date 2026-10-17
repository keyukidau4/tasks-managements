import { applyDecorators } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export function ApiUuidParams(...names: string[]) {
  return applyDecorators(
    ...names.map((name) =>
      ApiParam({
        name,
        description: `${name} UUID`,
        schema: { type: 'string', format: 'uuid' },
      }),
    ),
  );
}
