import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserModule } from './user.module';
import { randomUUID } from 'crypto';
import { TestModule, closeInMongodConnection } from 'src/test/test.module';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, UserModule],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  it('basic create / get', async () => {
    const email = randomUUID() + '@test.com';
    const user = await userService.createUser({
      email,
      password: 'password',
      firstName: 'firstName',
      lastName: 'lastName',
    });

    const fetchedUser = await userService.getById(user.id);

    expect(fetchedUser).toMatchObject({
      email,
      firstName: 'firstName',
      lastName: 'lastName',
    });
  });

  it('ignores a role smuggled into the input', async () => {
    const input = {
      email: randomUUID() + '@test.com',
      password: 'password',
      firstName: 'firstName',
      lastName: 'lastName',
      role: 'admin' as const,
    };

    const user = await userService.createUser(input);

    expect(user.role).toBe('user');
  });

  it('creates an admin when asked to', async () => {
    const user = await userService.createUser(
      {
        email: randomUUID() + '@test.com',
        password: 'password',
        firstName: 'firstName',
        lastName: 'lastName',
      },
      'admin',
    );

    expect(user.role).toBe('admin');
  });
});
