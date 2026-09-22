import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { BaseAppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { TestModule, closeInMongodConnection } from './test/test.module';

describe('App e2e', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, BaseAppModule],
    }).compile();

    app = module.createNestApplication();
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

  const getMeQuery = `
    query {
      getMe {
        id
        email
        firstName
        lastName
      }
    }
  `;

  const signUpAndSignIn = async () => {
    const email = randomUUID() + '@test.com';
    const password = randomUUID();

    await request(app.getHttpServer())
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

    const signInResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(signInInput:{ email: "${email}", password: "${password}" }) {
              id
              email
              firstName
              lastName
            }
          }
        `,
      })
      .expect(200);

    return { email, signInResponse };
  };

  test('sign-up, sign-in, getMe via the cookie', async () => {
    const { email, signInResponse } = await signUpAndSignIn();

    expect(signInResponse.body.data.login).toMatchObject({
      id: expect.any(String),
      email,
      firstName: 'firstName',
      lastName: 'lastName',
    });

    const cookie = signInResponse.headers['set-cookie'][0];
    expect(cookie).toContain('jwt=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const getMeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: getMeQuery })
      .expect(200);

    expect(getMeResponse.body.data.getMe).toMatchObject({
      id: expect.any(String),
      email,
      firstName: 'firstName',
      lastName: 'lastName',
    });
  });

  test('the jwt header is not a token transport', async () => {
    const { signInResponse } = await signUpAndSignIn();
    const token = signInResponse.headers['set-cookie'][0]
      .split('jwt=')[1]
      .split(';')[0];

    const getMeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('jwt', token)
      .send({ query: getMeQuery })
      .expect(200);

    expect(getMeResponse.body.errors).toBeDefined();
    expect(getMeResponse.body.data).toBeFalsy();
  });

  test('getMe rejects a missing or invalid cookie', async () => {
    for (const cookies of [[], ['jwt=not-a-valid-token']]) {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookies)
        .send({ query: getMeQuery })
        .expect(200);

      expect(response.body.errors?.[0]?.message).toBe('Unauthorized');
      expect(response.body.data).toBeFalsy();
    }
  });

  test('a stale cookie does not break public queries', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', ['jwt=expired-garbage'])
      .send({
        query: `
          query {
            getActivities {
              id
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.getActivities).toEqual([]);
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
