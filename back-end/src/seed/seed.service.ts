import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { User } from '../user/user.schema';
import { UserService } from '../user/user.service';
import { activities as activitiesData } from './activity.data';
import { user as userData, admin as adminData } from './user.data';

@Injectable()
export class SeedService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private userService: UserService,
    private activityService: ActivityService,
  ) {}

  async execute(): Promise<void> {
    let user = await this.userService.findByEmail(userData.email);
    const userExisted = Boolean(user);
    if (!user) {
      user = await this.userService.createUser(userData);
    }

    const admin = await this.userService.findByEmail(adminData.email);
    if (!admin) {
      const { id } = await this.userService.createUser(adminData);
      // createUser never makes admins: the dev seed promotes its own directly.
      await this.userModel.updateOne({ _id: id }, { role: 'admin' });
    }

    if (!userExisted) {
      try {
        await Promise.all(
          activitiesData.map((activity) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.activityService.create(user!._id, activity),
          ),
        );
        Logger.log('Seeding successful!');
      } catch (error) {
        Logger.error(error);
        throw error;
      }
    }
  }
}
