import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { UserModule } from '../user/user.module';
import { SeedService } from './seed.service';

@Module({
  imports: [UserModule, ActivityModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
