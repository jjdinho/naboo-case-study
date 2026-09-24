import { withAuth, withoutAuth } from "@/hocs";
import { useAuth } from "@/hooks";
import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import { act, renderHook, waitFor } from "@testing-library/react";
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
    push.mockReset();
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

  it("sends a user logging out of a protected page home, not to /signin", async () => {
    const ProtectedPage = withAuth(() => null);
    let onHome = false;
    const { result, rerender } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <Providers>
          {!onHome && <ProtectedPage />}
          {children}
        </Providers>
      ),
    });
    await act(() =>
      result.current.handleSignin({ email: "user1@test.fr", password: "b" })
    );
    push.mockClear();
    // Like Next: the new page replaces the protected one once it has loaded.
    push.mockImplementation(async (path: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (path === "/") {
        onHome = true;
        rerender();
      }
    });

    // React renders while the navigation is under way, as in a browser.
    let loggingOut = Promise.resolve();
    act(() => {
      loggingOut = result.current.handleLogout();
    });
    await waitFor(() => expect(onHome).toBe(true));
    await act(() => loggingOut);

    expect(push).not.toHaveBeenCalledWith("/signin");
  });

  it("sends a user signing in to their profile, not home", async () => {
    const SigninPage = withoutAuth(() => null);
    let onProfile = false;
    const { result, rerender } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <Providers>
          {!onProfile && <SigninPage />}
          {children}
        </Providers>
      ),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Like Next: the new page replaces the sign-in one once it has loaded.
    push.mockImplementation(async (path: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (path === "/profil") {
        onProfile = true;
        rerender();
      }
    });

    // React renders while the navigation is under way, as in a browser.
    let signingIn = Promise.resolve();
    act(() => {
      signingIn = result.current.handleSignin({
        email: "user1@test.fr",
        password: "b",
      });
    });
    await waitFor(() => expect(onProfile).toBe(true));
    await act(() => signingIn);

    expect(push).not.toHaveBeenCalledWith("/");
  });
});
