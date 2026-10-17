import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeService } from './home.service';

@Controller()
@ApiTags('Home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({ summary: 'Get the API welcome message' })
  getHello(): string {
    return this.homeService.getHello();
  }
}
