import { Controller, Get, Ip } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  @Public()
  getHello() {
    return {message:`Server is listening on http://10.10.20.44:3001`};
  }
}
