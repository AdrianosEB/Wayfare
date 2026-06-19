import { create } from 'zustand';
import type { User, SignupRequest, LoginRequest } from '@/types';
import {
  signup as apiSignup,
  login as apiLogin,
  logout as apiLogout,
  getMe,
  WayfareApiError,
} from '@/lib/api';

/**
 * Email + password auth state (AUTH_CONTRACT.md).
 *
 * Guest mode is the DEFAULT: `user: null` is a fully-functional, unauthenticated visitor.
 * This store only personalizes the TopBar — it never gates the planner. The session lives in
 * an httpOnly cookie; the API client always sends `credentials: 'include'`, so we keep no
 * token here.
 *
 * `hydrate()` runs once on app mount (wired in main.tsx) and resolves the current session via
 * GET /api/auth/me. It must never throw into the app: a failure leaves the user as a guest.
 */

export type AuthStatus =
  | 'idle' // before hydrate() — treated as guest
  | 'loading' // hydrate() in flight
  | 'authenticated'
  | 'guest';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  /** Last server/validation error from a signup/login attempt (cleared on success/retry). */
  error: string | null;
  /** A signup/login/logout request is in flight (drives button spinners). */
  pending: boolean;

  hydrate: () => Promise<void>;
  signup: (req: SignupRequest) => Promise<boolean>;
  login: (req: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/** Map an auth failure to friendly inline copy (AUTH_CONTRACT.md). */
function authErrorMessage(err: unknown): string {
  if (err instanceof WayfareApiError) {
    if (err.status === 409) return 'That email is already registered.';
    if (err.status === 401) return 'Invalid email or password.';
    if (err.message) return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,
  pending: false,

  /** Called ONCE on app mount. Resolves the session; never throws into the app. */
  async hydrate() {
    set({ status: 'loading' });
    try {
      const { user } = await getMe();
      set({ user, status: user ? 'authenticated' : 'guest' });
    } catch {
      // Offline / server down / unexpected — degrade to guest, keep the app usable.
      set({ user: null, status: 'guest' });
    }
  },

  async signup(req) {
    set({ pending: true, error: null });
    try {
      const { user } = await apiSignup(req);
      set({ user, status: 'authenticated', pending: false });
      return true;
    } catch (err) {
      set({ error: authErrorMessage(err), pending: false });
      return false;
    }
  },

  async login(req) {
    set({ pending: true, error: null });
    try {
      const { user } = await apiLogin(req);
      set({ user, status: 'authenticated', pending: false });
      return true;
    } catch (err) {
      set({ error: authErrorMessage(err), pending: false });
      return false;
    }
  },

  async logout() {
    set({ pending: true });
    try {
      await apiLogout();
    } catch {
      // Best-effort: even if the network call fails, drop the local session.
    }
    set({ user: null, status: 'guest', pending: false, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));
