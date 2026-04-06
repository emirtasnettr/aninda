import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'Teslimatjet API',
      docs: 'Use POST /auth/login or see README for example endpoints.',
    };
  }
}
