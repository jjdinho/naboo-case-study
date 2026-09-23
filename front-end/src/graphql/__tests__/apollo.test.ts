import { gql } from "@apollo/client";
import { vi } from "vitest";
import { graphqlClient } from "../apollo";

const GetUserActivities = gql`
  query GetUserActivities {
    getActivitiesByUser {
      id
    }
  }
`;

// Answers with the id of whoever's cookie the request carries.
const fetchAsCookieOwner = async (_uri: string, init: RequestInit) => {
  const owner = (init.headers as Record<string, string>).cookie;
  const data = {
    getActivitiesByUser: [{ __typename: "Activity", id: owner }],
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
      const { data } = await graphqlClient.query({
        query: GetUserActivities,
        context: { headers: { Cookie: cookie } },
      });
      ids.push(data.getActivitiesByUser[0].id);
    }

    expect(ids).toEqual(["jwt=alice", "jwt=bob"]);
  });
});
