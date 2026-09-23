# Naboo interview

## What's used ?

backend

- mongodb
- nestjs
- mongoose
- data mapper pattern
- graphql

frontend

- nextjs (with page router)
- mantine-ui
- axios
- vitest
- graphql
- apollo client

## How to launch project ?

backend

```bash
npm i

npm run start:dev
```

frontend

```bash
npm i

npm run generate-types # run this first — the GraphQL types aren't committed

npm run dev
```

after graphql modification

```bash
# > frontend
npm run generate-types
```

## Connection informations

email: user1@test.fr
password: user1

admin (seeded in development)

email: admin@test.fr
password: admin

The app never creates admins. To promote a user, set its role in MongoDB:

```bash
mongosh "$MONGO_URI" --eval 'db.users.updateOne({ email: "someone@example.com" }, { $set: { role: "admin" } })'
```
