import { parse } from "graphql";
import { vi } from "vitest";
import { graphqlClient } from "../apollo";

// parse, not gql: codegen collects every gql document under src/graphql.
const ActivitiesByCookie = parse(`
  query ActivitiesByCookie {
    getActivitiesByUser {
      id
    }
  }
`);

interface ActivitiesByCookieQuery {
  getActivitiesByUser: { __typename: "Activity"; id: string }[];
}

// Answers with an activity named after whoever's cookie the request carries.
const fetchAsCookieOwner = async (_uri: string, init: RequestInit) => {
  const cookie = (init.headers as Record<string, string>).cookie;
  const data: ActivitiesByCookieQuery = {
    getActivitiesByUser: [{ __typename: "Activity", id: cookie }],
  };
  return new Response(JSON.stringify({ data }));
};

describe("graphqlClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never answers one user's query from another user's cache", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchAsCookieOwner));

    const ids = [];
    for (const cookie of ["jwt=alice", "jwt=bob"]) {
      const { data } = await graphqlClient.query<ActivitiesByCookieQuery>({
        query: ActivitiesByCookie,
        context: { headers: { Cookie: cookie } },
      });
      ids.push(data.getActivitiesByUser[0].id);
    }

    expect(ids).toEqual(["jwt=alice", "jwt=bob"]);
  });
});
