import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health-check')
  getHealthCheck(): string {
    return 'Server is running!';
  }
}
