import { Module } from '@nestjs/common';
import { ActivityModule } from 'src/activity/activity.module';
import { UserModule } from 'src/user/user.module';
import { FavoriteResolver } from './favorite.resolver';
import { FavoriteService } from './favorite.service';

@Module({
  // The User model comes from UserModule: favorites are stored on the user
  // document, and this module owns the rules for that array, not the document.
  imports: [UserModule, ActivityModule],
  providers: [FavoriteService, FavoriteResolver],
})
export class FavoriteModule {}
