import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { flushAccountSync, resetAccountSync, syncAccount } from '@/lib/accountSync';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCheckout } from '@/stores/checkout';
import { useWishlist } from '@/stores/wishlist';
import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest, User } from '@/types/api';

export interface Me {
  /** null when signed out, and while the first check is still running. */
  user: User | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  /** True until the first answer arrives. Guards wait for this before redirecting. */
  isPending: boolean;
}

/** Who is signed in. */
export function useMe(): Me {
  const query = useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => api.auth.me({ signal }),
    staleTime: 5 * 60_000,
  });
  const user = query.data?.user ?? null;
  return { user, isSignedIn: user !== null, isAdmin: user?.role === 'admin', isPending: query.isPending };
}

/**
 * Signs in on the server, then merges this device's wishlist and garage with the account
 * before the mutation resolves, so the next page already shows the combined lists.
 */
async function signIn(response: Promise<AuthResponse>): Promise<AuthResponse> {
  const auth = await response;
  await syncAccount(auth.user.id, 'merge');
  return auth;
}

function signedIn(queryClient: QueryClient, auth: AuthResponse): void {
  queryClient.setQueryData<MeResponse>(queryKeys.me(), { user: auth.user });
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() });
}

/** `mutate({ email, password })`. A wrong password is an ApiError with status 401. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => signIn(api.auth.login(body)),
    onSuccess: (auth) => signedIn(queryClient, auth),
  });
}

/** `mutate({ name, email, phone, password })`. A taken email is an ApiError with status 409. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterRequest) => signIn(api.auth.register(body)),
    onSuccess: (auth) => signedIn(queryClient, auth),
  });
}

/**
 * Signs out. Saves any pending wishlist or garage change first, then clears what belongs
 * to the account from this device: the wishlist and the checkout draft. The cart and the
 * garage stay, because a guest uses those too.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await flushAccountSync();
      return api.auth.logout();
    },
    onSuccess: () => {
      resetAccountSync();
      useWishlist.getState().clear();
      useCheckout.getState().clear();
      queryClient.setQueryData<MeResponse>(queryKeys.me(), { user: null });
      queryClient.removeQueries({ queryKey: queryKeys.account.all() });
      queryClient.removeQueries({ queryKey: queryKeys.admin.all() });
      queryClient.removeQueries({ queryKey: queryKeys.orders.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() });
    },
  });
}
