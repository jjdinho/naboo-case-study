import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ActivityService } from './activity.service';
import { ActivityModule } from './activity.module';
import { TestModule, closeInMongodConnection } from 'src/test/test.module';
describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, ActivityModule],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByCity', () => {
    beforeEach(async () => {
      const owner = new Types.ObjectId().toString();
      await service.create(owner, {
        name: 'Kayak sur la Seine',
        city: 'Paris',
        description: 'Balade en kayak',
        price: 25,
      });
    });

    it('matches the activity filter as a case-insensitive substring', async () => {
      expect(await service.findByCity('Paris', 'kayak')).toHaveLength(1);
      expect(await service.findByCity('Paris', 'escalade')).toHaveLength(0);
    });

    it('treats regex metacharacters in the activity filter as literals', async () => {
      expect(await service.findByCity('Paris', '.*')).toHaveLength(0);
      expect(await service.findByCity('Paris', 'K.y.k')).toHaveLength(0);
    });
  });

  describe('findByIds', () => {
    it('returns activities in the order of the ids, skipping unknown ones', async () => {
      const owner = new Types.ObjectId().toString();
      const [kayak, yoga] = await Promise.all(
        ['Kayak', 'Yoga'].map((name) =>
          service.create(owner, {
            name,
            city: 'Paris',
            description: 'Description',
            price: 10,
          }),
        ),
      );
      const unknown = new Types.ObjectId().toString();

      const activities = await service.findByIds([yoga.id, unknown, kayak.id]);

      expect(activities.map((activity) => activity.name)).toEqual([
        'Yoga',
        'Kayak',
      ]);
    });
  });
});
