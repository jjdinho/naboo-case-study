import { Module } from '@nestjs/common';
import { ActivityModule } from 'src/activity/activity.module';
import { UserModule } from 'src/user/user.module';
import { FavoriteResolver } from './favorite.resolver';
import { FavoriteService } from './favorite.service';

@Module({
  imports: [UserModule, ActivityModule],
  providers: [FavoriteService, FavoriteResolver],
})
export class FavoriteModule {}
