import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API health' })
  getHealth() {
    return { status: 'ok' };
  }
}
