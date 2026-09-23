import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { User, UserSchema } from '../user/user.schema';
import { UserModule } from '../user/user.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserModule,
    ActivityModule,
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
