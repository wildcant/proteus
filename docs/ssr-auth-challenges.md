# SSR + localStorage Auth: Challenges and Findings

## Context

The store app uses TanStack Start with SSR enabled. Auth tokens are stored in `localStorage`. This combination creates a fundamental mismatch: the server cannot access `localStorage`, so any auth-dependent logic that runs during SSR operates without knowledge of the user's authentication state.

## Core problem

`localStorage` is a client-only API. During SSR:

- `getToken()` always returns `null`
- `getCartId()` always returns `null`
- Any `beforeLoad` guard that checks these values will behave as if the user is unauthenticated

## Findings

### 1. `beforeLoad` does not re-run during hydration

TanStack Start serializes the result of `beforeLoad` (and `loader`) on the server and dehydrates it to the client. During hydration, the client uses the server's result — it does **not** re-run `beforeLoad`. It only runs again on subsequent client-side navigations.

This means:

- A `throw redirect({ to: '/login' })` in `beforeLoad` causes a **server-side 302**, which the browser follows before any client JS loads. The user never gets a chance to hydrate with their localStorage token.
- Skipping the redirect on the server (`typeof localStorage === 'undefined'`) prevents the 302, but the redirect never fires on the client either, because `beforeLoad` doesn't re-run during hydration.

### 2. Component-level `useEffect` redirects are slow

Adding `useEffect` in the component to handle the hydration case works, but the redirect only fires after mount. The user sees the wrong page (e.g., the login form) for a frame or two before being redirected. This creates a visible flash.

### 3. React Query retains stale data for disabled queries

`useMe()` uses `enabled: !!token` to skip fetching when logged out. However, React Query deliberately retains the last successful data when a query becomes disabled. After logout:

- `clearToken()` is synchronous (localStorage)
- `enabled` becomes `false` on the next render
- But `data` still holds the previous customer object

This caused the `CartMismatchBanner` to flicker — it briefly saw stale `customer` data alongside a mismatched cart after logout. The fix: guard the return value with the same `enabled` flag so disabled queries don't leak stale data.

```ts
const enabled = !!token && (options?.enabled ?? true)
// ...
return { customer: enabled ? (data?.customer ?? null) : null, ...rest }
```

### 4. `queryClient.resetQueries()` vs `clear()` vs `removeQueries()`

None of these reliably clear data from active observers in the same render:

| Method | Behavior | Issue |
|---|---|---|
| `clear()` | Removes queries from cache | Observers hold stale references; not notified of removal |
| `removeQueries()` | Same as clear for queries | Same stale observer issue |
| `resetQueries()` | Resets state + refetches active queries | Observer options (`enabled`) are stale until next render; refetch races |

The observer's `enabled` option is computed during render (from `getToken()`). Cache operations notify observers, but the observer still uses the old `enabled` value until the component re-renders and calls `useQuery` with updated options. This creates a timing gap where stale data can leak through.

## Current workarounds

1. **SSR guard in `beforeLoad`**: skip redirects when `typeof localStorage === 'undefined'`
2. **`useEffect` redirect in components**: handles the hydration case (slow, causes flash)
3. **`enabled` guard on `useMe` return value**: prevents stale customer data after logout
4. **`resetQueries()` on logout**: best-effort cache clearing (combined with the `enabled` guard)

## Proper fix: cookies

Moving the auth token to an HTTP-only cookie would solve all of these issues at once:

- Server can read the cookie during SSR, so `beforeLoad` guards work correctly
- No stale localStorage reads, no SSR/client mismatch
- `beforeLoad` redirects work as server-side 302s (which is actually correct when the cookie is absent)
- Bonus: tokens are no longer accessible to XSS attacks

This requires:
- Backend sets/clears an HTTP-only cookie on login/logout endpoints
- Fetcher sends credentials (`credentials: 'include'` or cookies travel automatically)
- CSRF protection (SameSite + token or double-submit pattern)
- Cookie config per environment (domain, path, Secure, SameSite)
- Remove all `getToken`/`setToken`/`clearToken` localStorage usage
- Update `api-caller` (backend-as-library) to forward cookies from the incoming request
