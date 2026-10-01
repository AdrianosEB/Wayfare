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
 * `user: null` is a guest, which is the default. This store only personalizes the TopBar
 * and never gates the planner. The session lives in an httpOnly cookie, so no token is kept
 * here.
 *
 * `hydrate()` runs once on app mount (main.tsx) and resolves the session via
 * GET /api/auth/me. It must never throw: a failure leaves the user as a guest.
 */

export type AuthStatus =
  | 'idle' // before hydrate(), treated as guest
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

  /** Called once on app mount. Never throws. */
  async hydrate() {
    set({ status: 'loading' });
    try {
      const { user } = await getMe();
      set({ user, status: user ? 'authenticated' : 'guest' });
    } catch {
      // Offline or server down: degrade to guest.
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
