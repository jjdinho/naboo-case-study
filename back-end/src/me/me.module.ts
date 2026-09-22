import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { MeResolver } from './resolver/me.resolver';

@Module({
  imports: [UserModule],
  providers: [MeResolver],
})
export class MeModule {}
