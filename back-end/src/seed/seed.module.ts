import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { UserModule } from '../user/user.module';
import { SeedService } from './seed.service';

@Module({
  // UserModule brings both UserService and the User model: the seeder creates
  // users through the service, then promotes its admin on the document.
  imports: [UserModule, ActivityModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
