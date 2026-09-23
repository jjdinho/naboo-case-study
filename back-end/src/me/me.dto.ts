import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Role } from 'src/user/user.schema';

// The logged-in user, seen only by themselves. User is also Activity.owner,
// which anyone can list, so fields private to the owner go here instead.
@ObjectType()
export class Me {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field(() => Role)
  role!: Role;
}
