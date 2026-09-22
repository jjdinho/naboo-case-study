import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { SeedService } from './seed/seed.service';

describe('AppService', () => {
  const setup = async (nodeEnv?: string) => {
    const seedService = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: SeedService, useValue: seedService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(nodeEnv) },
        },
      ],
    }).compile();

    return { appService: module.get(AppService), seedService };
  };

  it('seeds on bootstrap in development', async () => {
    const { appService, seedService } = await setup('development');
    await appService.onApplicationBootstrap();
    expect(seedService.execute).toHaveBeenCalled();
  });

  it('does not seed outside development', async () => {
    const { appService, seedService } = await setup('production');
    await appService.onApplicationBootstrap();
    expect(seedService.execute).not.toHaveBeenCalled();
  });
});
