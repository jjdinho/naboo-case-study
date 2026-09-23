import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { BaseAppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import * as cookieParser from 'cookie-parser';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { ActivityService } from './activity/activity.service';
import { TestModule, closeInMongodConnection } from './test/test.module';
import { Role, User } from './user/user.schema';
import { UserService } from './user/user.service';

describe('App e2e', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, BaseAppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    closeInMongodConnection();
  });

  const tokenFor = (id: string) =>
    new JwtService().signAsync(
      { id },
      { secret: app.get(ConfigService).get<string>('JWT_SECRET') },
    );

  it('app should be defined', () => {
    expect(app).toBeDefined();
  });

  test('sign-up, sign-in, getMe', async () => {
    const email = randomUUID() + '@test.com';
    const password = randomUUID();

    const signUpResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            register(signUpInput:{ email: "${email}", password: "${password}", firstName: "firstName", lastName: "lastName" }) {
              id
            }
          }
        `,
      })
      .expect(200);

    expect(signUpResponse.status).toBe(200);
    expect(signUpResponse.body.data.register.id).toEqual(expect.any(String));

    const signInResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(signInInput:{ email: "${email}", password: "${password}" }) {
              access_token
            }
          }
        `,
      })
      .expect(200);

    expect(signInResponse.status).toBe(200);
    const jwt = signInResponse.body.data.login.access_token;
    expect(jwt).toEqual(expect.any(String));

    const getMeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('jwt', jwt)
      .send({
        query: `
          query {
            getMe {
              id
              email
              firstName
              lastName
              role
            }
          }
        `,
      })
      .expect(200);

    expect(getMeResponse.body.data.getMe).toMatchObject({
      id: expect.any(String),
      email,
      firstName: 'firstName',
      lastName: 'lastName',
      role: 'user',
    });
  });

  test('getMe returns the admin role', async () => {
    const { id } = await app.get(UserService).createUser({
      email: randomUUID() + '@test.com',
      password: randomUUID(),
      firstName: 'firstName',
      lastName: 'lastName',
    });
    // Admins are promoted by hand in the database.
    await app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ _id: id }, { role: Role.admin });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('jwt', await tokenFor(id))
      .send({ query: 'query { getMe { role } }' })
      .expect(200);

    expect(response.body.data.getMe).toEqual({ role: 'admin' });
  });

  test('sign-up rejects a malformed email', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            register(signUpInput:{ email: "not-an-email", password: "password", firstName: "firstName", lastName: "lastName" }) {
              id
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
  });

  describe('stale jwt cookie', () => {
    const expiredCookie = async () => {
      const secret = app.get(ConfigService).get<string>('JWT_SECRET');
      const token = await new JwtService().signAsync(
        {
          id: '652d9a4b8f1b2c3d4e5f6a7b',
          email: 'stale@test.com',
          firstName: 'firstName',
          lastName: 'lastName',
        },
        { secret, expiresIn: -60 },
      );
      return `jwt=${token}`;
    };

    test('public queries still succeed', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', await expiredCookie())
        .send({ query: 'query { getActivities { id } }' })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getActivities).toEqual([]);
    });

    test('protected queries are still rejected', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', await expiredCookie())
        .send({ query: 'query { getMe { id } }' })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.data).toBeNull();
    });
  });

  // User is also Activity.owner, which anyone can list.
  test.each(['email', 'password', 'favoriteActivityIds', 'role'])(
    '%s is not exposed on the shared User type',
    async (field) => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: `query { getActivities { owner { ${field} } } }` });

      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'GRAPHQL_VALIDATION_FAILED',
      );
    },
  );

  describe('favorites', () => {
    test('require login', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: 'query { getFavoriteActivities { id } }' })
        .expect(200);

      expect(response.body.errors?.[0]?.message).toBe('Unauthorized');
    });

    test('reject a malformed activity id', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('jwt', await tokenFor('652d9a4b8f1b2c3d4e5f6a7b'))
        .send({
          query: 'mutation { addFavoriteActivity(activityId: "nope") { id } }',
        })
        .expect(200);

      expect(response.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
    });

    test('add a favorite and read it back', async () => {
      const user = await app.get(UserService).createUser({
        email: randomUUID() + '@test.com',
        password: randomUUID(),
        firstName: 'firstName',
        lastName: 'lastName',
      });
      const activity = await app.get(ActivityService).create(user.id, {
        name: 'Kayak',
        city: 'Paris',
        description: 'Description',
        price: 10,
      });
      const jwt = await tokenFor(user.id);

      await request(app.getHttpServer())
        .post('/graphql')
        .set('jwt', jwt)
        .send({
          query: `mutation { addFavoriteActivity(activityId: "${activity.id}") { id } }`,
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('jwt', jwt)
        .send({ query: 'query { getFavoriteActivities { name } }' })
        .expect(200);

      expect(response.body.data.getFavoriteActivities).toEqual([
        { name: 'Kayak' },
      ]);
    });
  });
});
