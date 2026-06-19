import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { AuthModal, type AuthMode } from './AuthModal';

/**
 * TopBar auth surface (AUTH_CONTRACT.md §guest behavior):
 *   - Logged out → "Log in" (ghost) + "Sign up" (solid azure) → open the modal.
 *   - Logged in  → an avatar/initial button → small menu with name/email + "Log out".
 *
 * This only personalizes the chrome; guest mode is the default and the app stays fully usable.
 * `onLight` makes the controls legible over a transparent hero (used by the landing nav).
 */

export interface AuthControlsProps {
  /** When true, render for a dark/photo background (landing hero) before the nav goes solid. */
  onLight?: boolean;
  className?: string;
}

export function AuthControls({ onLight = false, className }: AuthControlsProps) {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [modal, setModal] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: 'login',
  });

  const openModal = (mode: AuthMode) => setModal({ open: true, mode });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  // While the session is resolving, render nothing in place of the buttons to avoid a flash
  // of "Log in" for an already-authenticated user. Guest/idle still shows the CTAs.
  const resolving = status === 'loading' || status === 'idle';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {user ? (
        <AccountMenu onLight={onLight} />
      ) : resolving ? (
        <span aria-hidden className="h-9 w-px" />
      ) : (
        <>
          <button
            type="button"
            onClick={() => openModal('login')}
            className={cn(
              'rounded-pill px-3.5 py-2 text-sm font-semibold transition focus-visible:ring-2',
              onLight
                ? 'text-white/90 hover:bg-white/10 hover:text-white'
                : 'text-azure-700 hover:bg-azure-50',
            )}
          >
            Log in
          </button>
          <Button onClick={() => openModal('signup')}>Sign up</Button>
        </>
      )}

      <AuthModal open={modal.open} mode={modal.mode} onClose={closeModal} />
    </div>
  );
}

/* ----------------------------------------------------------------- account menu --- */

function initialOf(user: { name: string; email: string }): string {
  const source = user.name.trim() || user.email.trim();
  return source.charAt(0).toUpperCase() || '?';
}

function AccountMenu({ onLight }: { onLight: boolean }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name || user.email}`}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-pill text-sm font-semibold transition focus-visible:ring-2',
          onLight
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'bg-azure-50 text-azure-700 hover:bg-azure-100',
        )}
      >
        {initialOf(user)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-md border border-border bg-bg shadow-float"
          >
            <div className="border-b border-border px-4 py-3">
              {user.name && (
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              )}
              <p className="truncate text-xs text-ink-2">{user.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="block w-full px-4 py-3 text-left text-sm font-medium text-ink transition hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
            >
              Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
