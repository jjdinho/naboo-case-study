import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity } from 'src/activity/activity.schema';
import { ActivityService } from 'src/activity/activity.service';
import { User } from 'src/user/user.schema';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private activityService: ActivityService,
  ) {}

  async findByUser(userId: string): Promise<Activity[]> {
    const user = await this.userModel
      .findById(userId, 'favoriteActivityIds')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.activityService.findByIds(user.favoriteActivityIds.map(String));
  }

  async add(userId: string, activityId: string): Promise<Activity[]> {
    await this.activityService.findOne(activityId);
    await this.userModel
      .updateOne(
        { _id: userId },
        { $addToSet: { favoriteActivityIds: activityId } },
      )
      .exec();
    return this.findByUser(userId);
  }

  async remove(userId: string, activityId: string): Promise<Activity[]> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $pull: { favoriteActivityIds: activityId } },
      )
      .exec();
    return this.findByUser(userId);
  }
}
