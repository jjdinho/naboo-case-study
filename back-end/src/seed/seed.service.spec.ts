import { Test, TestingModule } from '@nestjs/testing';
import { TestModule, closeInMongodConnection } from 'src/test/test.module';
import { UserService } from 'src/user/user.service';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TestModule, SeedModule],
    }).compile();
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  it('seeds one admin and one regular user', async () => {
    await module.get(SeedService).execute();

    const userService = module.get(UserService);
    expect((await userService.getByEmail('admin@test.fr')).role).toBe('admin');
    expect((await userService.getByEmail('user1@test.fr')).role).toBe('user');
  });
});
