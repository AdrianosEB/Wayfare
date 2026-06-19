import { forwardRef, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { XIcon } from './icons';

/**
 * Accessible email + password modal (AUTH_CONTRACT.md) in the azure design system.
 *
 *  - role="dialog" aria-modal, labeled by the title; focus trapped inside; Esc closes.
 *  - Toggles between Log in / Sign up; inline client validation + server error copy.
 *  - It NEVER blocks the app — there is always a close button and a "Maybe later" link, and
 *    the backdrop/Esc dismiss it. Guest mode keeps working underneath.
 */

export type AuthMode = 'login' | 'signup';

export interface AuthModalProps {
  open: boolean;
  /** Which form to show first; the user can still toggle inside. */
  mode: AuthMode;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(mode: AuthMode, name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'signup' && !name.trim()) errors.name = 'Please enter your name.';
  if (!email.trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'That doesn’t look like an email.';
  if (!password) errors.password = 'Please enter a password.';
  else if (password.length < 8) errors.password = 'Use at least 8 characters.';
  return errors;
}

export function AuthModal({ open, mode: initialMode, onClose }: AuthModalProps) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const serverError = useAuth((s) => s.error);
  const pending = useAuth((s) => s.pending);
  const signup = useAuth((s) => s.signup);
  const login = useAuth((s) => s.login);
  const clearError = useAuth((s) => s.clearError);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Reset transient state and sync mode whenever the modal (re)opens.
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setName('');
    setEmail('');
    setPassword('');
    setFieldErrors({});
    setSubmitted(false);
    clearError();
  }, [open, initialMode, clearError]);

  // Focus management: remember the trigger, focus the first field, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Esc to close + focus trap (Tab cycles within the dialog).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFieldErrors({});
    setSubmitted(false);
    clearError();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errors = validate(mode, name, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const ok =
      mode === 'signup'
        ? await signup({ name: name.trim(), email: email.trim(), password })
        : await login({ email: email.trim(), password });
    if (ok) onClose();
  };

  const isSignup = mode === 'signup';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6"
          // Appear solid immediately (never gate the whole modal on an opacity tween that can
          // stall and leave it see-through); keep the fade-OUT on close.
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop — click to dismiss (never traps the user). */}
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-scrim/45 backdrop-blur-[2px]"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={false}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative w-full max-w-md overflow-hidden rounded-t-lg bg-bg shadow-float sm:rounded-lg',
              'border border-border',
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <h2 id={titleId} className="font-display text-2xl font-semibold text-ink">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  {isSignup
                    ? 'Save trips and pick up where you left off.'
                    : 'Log in to see your saved trips.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink-3 transition hover:bg-surface hover:text-ink focus-visible:ring-2"
              >
                <XIcon className="text-lg" />
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-6 pb-6 pt-5">
              {isSignup && (
                <Field
                  ref={firstFieldRef}
                  id={`${titleId}-name`}
                  label="Name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={setName}
                  error={submitted ? fieldErrors.name : undefined}
                  placeholder="Alex Rivera"
                />
              )}
              <Field
                ref={isSignup ? undefined : firstFieldRef}
                id={`${titleId}-email`}
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                error={submitted ? fieldErrors.email : undefined}
                placeholder="you@example.com"
              />
              <Field
                id={`${titleId}-password`}
                label="Password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={setPassword}
                error={submitted ? fieldErrors.password : undefined}
                placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
              />

              {serverError && (
                <p
                  role="alert"
                  className="rounded-sm border border-over/30 bg-over/10 px-3 py-2 text-sm text-over"
                >
                  {serverError}
                </p>
              )}

              <Button type="submit" size="lg" loading={pending} className="w-full">
                {isSignup ? 'Sign up' : 'Log in'}
              </Button>

              <p className="text-center text-sm text-ink-2">
                {isSignup ? 'Already have an account?' : 'New to Wayfare?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                  className="rounded-sm font-semibold text-azure-700 hover:underline focus-visible:ring-2"
                >
                  {isSignup ? 'Log in' : 'Create one'}
                </button>
              </p>

              <button
                type="button"
                onClick={onClose}
                className="rounded-sm text-center text-xs font-medium text-ink-3 hover:text-ink-2 focus-visible:ring-2"
              >
                Maybe later — keep exploring as a guest
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------------------------------------------- labeled field --- */

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  onChange: (v: string) => void;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, type, value, autoComplete, placeholder, error, onChange },
  ref,
) {
  const errId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-sm border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3',
          'transition focus:outline-none focus-visible:ring-2',
          error ? 'border-over focus:border-over' : 'border-border focus:border-azure-400',
        )}
      />
      {error && (
        <p id={errId} className="text-xs font-medium text-over">
          {error}
        </p>
      )}
    </div>
  );
});
