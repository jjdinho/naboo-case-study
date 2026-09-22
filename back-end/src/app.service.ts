import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeedService } from './seed/seed.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    private seedService: SeedService,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.configService.get('NODE_ENV') !== 'development') return;
    await this.seedService.execute();
  }
}
