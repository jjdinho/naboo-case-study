import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Activity } from 'src/activity/activity.schema';
import { ActivityService } from 'src/activity/activity.service';
import { TestModule, closeInMongodConnection } from 'src/test/test.module';
import { UserModule } from 'src/user/user.module';
import { UserService } from 'src/user/user.service';
import { FavoriteModule } from './favorite.module';
import { FavoriteService } from './favorite.service';

const names = (activities: Activity[]) =>
  activities.map((activity) => activity.name);

describe('FavoriteService', () => {
  let service: FavoriteService;
  let userId: string;
  let kayak: string;
  let escalade: string;
  let yoga: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, FavoriteModule, UserModule],
    }).compile();

    service = module.get<FavoriteService>(FavoriteService);

    const user = await module.get<UserService>(UserService).createUser({
      email: 'user@test.fr',
      password: 'password',
      firstName: 'firstName',
      lastName: 'lastName',
    });
    userId = user.id;

    const activityService = module.get<ActivityService>(ActivityService);
    [kayak, escalade, yoga] = await Promise.all(
      ['Kayak', 'Escalade', 'Yoga'].map(async (name) => {
        const activity = await activityService.create(userId, {
          name,
          city: 'Paris',
          description: 'Description',
          price: 10,
        });
        return activity.id;
      }),
    );
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  it('starts with no favorites', async () => {
    expect(await service.findByUser(userId)).toEqual([]);
  });

  describe('add', () => {
    it('appends favorites in the order they are added', async () => {
      await service.add(userId, yoga);

      expect(names(await service.add(userId, kayak))).toEqual([
        'Yoga',
        'Kayak',
      ]);
    });

    it('keeps a single entry when the same activity is added twice', async () => {
      await service.add(userId, kayak);

      expect(names(await service.add(userId, kayak))).toEqual(['Kayak']);
    });

    it('rejects an activity that does not exist', async () => {
      const unknown = new Types.ObjectId().toString();

      await expect(service.add(userId, unknown)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the activity and keeps the order of the rest', async () => {
      await service.add(userId, kayak);
      await service.add(userId, escalade);
      await service.add(userId, yoga);

      expect(names(await service.remove(userId, escalade))).toEqual([
        'Kayak',
        'Yoga',
      ]);
    });
  });

  describe('reorder', () => {
    beforeEach(async () => {
      await service.add(userId, kayak);
      await service.add(userId, yoga);
    });

    it('saves the new order', async () => {
      await service.reorder(userId, [yoga, kayak]);

      expect(names(await service.findByUser(userId))).toEqual([
        'Yoga',
        'Kayak',
      ]);
    });

    it.each([
      ['a favorite is missing', () => [yoga]],
      ['an activity is not a favorite', () => [yoga, kayak, escalade]],
      ['an activity is repeated', () => [yoga, yoga]],
    ])('rejects the list when %s', async (_, activityIds) => {
      await expect(service.reorder(userId, activityIds())).rejects.toThrow(
        BadRequestException,
      );

      expect(names(await service.findByUser(userId))).toEqual([
        'Kayak',
        'Yoga',
      ]);
    });
  });
});
