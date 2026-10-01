import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  // MongooseModule is exported so a module needing the User document itself,
  // rather than user business logic, shares this registration instead of
  // declaring the schema again.
  exports: [UserService, MongooseModule],
  providers: [UserService],
})
export class UserModule {}
