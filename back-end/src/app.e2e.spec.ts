import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { BaseAppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { TestModule, closeInMongodConnection } from './test/test.module';

describe('App e2e', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, BaseAppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    closeInMongodConnection();
  });
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
              email
            }
          }
        `,
      })
      .expect(200);

    expect(signUpResponse.status).toBe(200);
    expect(signUpResponse.body.data.register.email).toBe(email);

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
    });
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

  test('password is not exposed in the GraphQL schema', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            getMe {
              password
            }
          }
        `,
      });

    expect(response.body.errors?.[0]?.extensions?.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
  });
});
