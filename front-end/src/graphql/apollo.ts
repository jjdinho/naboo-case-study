import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const graphqlClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: "http://localhost:3000/graphql",
    credentials: "include",
  }),
  ssrMode: typeof window === "undefined",
  // Every server request shares this client: never answer from another's cache.
  defaultOptions: { query: { fetchPolicy: "no-cache" } },
});
