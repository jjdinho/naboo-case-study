import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum Role {
  user = 'user',
  admin = 'admin',
}

registerEnumType(Role, { name: 'Role' });

@ObjectType()
@Schema({ timestamps: true })
export class User extends Document {
  @Field(() => ID)
  id!: string;

  @Prop({ required: true, enum: Object.values(Role), default: Role.user })
  role!: Role;

  @Field()
  @Prop({ required: true })
  firstName!: string;

  @Field()
  @Prop({ required: true })
  lastName!: string;

  @Field()
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop()
  token?: string;

  // No @Field: User is also Activity.owner, so a field here would expose
  // everyone's favorites. Array order is display order.
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }],
    default: [],
  })
  favoriteActivityIds!: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
