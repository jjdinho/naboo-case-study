import { useAuth } from "@/hooks";
import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { AuthProvider } from "../authContext";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/router", () => ({ useRouter: () => ({ push }) }));

const users: Record<string, object> = {
  "admin@test.fr": { id: "admin", firstName: "Admin", lastName: "Boss" },
  "user1@test.fr": { id: "user1", firstName: "John", lastName: "Doe" },
};

// A fake API: login opens a session, logout closes it, getMe answers for it.
let session: string | null = null;
const fakeApi = async (_uri: string, init: RequestInit) => {
  const { operationName, variables } = JSON.parse(init.body as string);
  const answers: Record<string, () => object> = {
    Signin: () => {
      session = variables.signInInput.email;
      return { login: { __typename: "SignInDto", access_token: "token" } };
    },
    GetUser: () => ({
      getMe: {
        __typename: "Me",
        ...users[session!],
        email: session,
        role: "user",
      },
    }),
    Logout: () => {
      session = null;
      return { logout: true };
    },
  };
  return new Response(JSON.stringify({ data: answers[operationName]() }));
};

let client: ApolloClient<NormalizedCacheObject>;
const Providers = ({ children }: { children: React.ReactNode }) => (
  <ApolloProvider client={client}>
    <AuthProvider>{children}</AuthProvider>
  </ApolloProvider>
);

describe("auth", () => {
  beforeEach(() => {
    client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ uri: "/graphql", fetch: fakeApi }),
    });
  });

  afterEach(() => {
    localStorage.clear();
    session = null;
    push.mockClear();
  });

  it("signs in the next user after a logout, not the previous one", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Providers });

    await act(() =>
      result.current.handleSignin({ email: "admin@test.fr", password: "a" })
    );
    await act(() => result.current.handleLogout());
    await act(() =>
      result.current.handleSignin({ email: "user1@test.fr", password: "b" })
    );

    expect(result.current.user?.email).toBe("user1@test.fr");
  });

  it("forgets the previous user's data on logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Providers });

    await act(() =>
      result.current.handleSignin({ email: "admin@test.fr", password: "a" })
    );
    expect(client.extract()).not.toEqual({});
    await act(() => result.current.handleLogout());

    expect(client.extract()).toEqual({});
  });
});
