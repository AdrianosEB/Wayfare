import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { SendIcon } from './icons';

/**
 * The hero free-text input AND the persistent refine input (same component, two variants).
 * Enter submits, Shift+Enter newlines; the textarea auto-grows. Big tap target, low chrome.
 */
export interface PromptInputProps {
  onSubmit: (text: string) => void;
  variant?: 'hero' | 'refine';
  placeholder?: string;
  busy?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Controlled value (optional) — used when example chips prefill the hero input. */
  value?: string;
  onValueChange?: (v: string) => void;
}

export function PromptInput({
  onSubmit,
  variant = 'hero',
  placeholder,
  busy = false,
  disabled = false,
  autoFocus = false,
  value,
  onValueChange,
}: PromptInputProps) {
  const [internal, setInternal] = useState('');
  const text = value ?? internal;
  const ref = useRef<HTMLTextAreaElement>(null);
  const isHero = variant === 'hero';

  const setText = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  // Auto-grow the textarea to fit content.
  //
  // Measured on a rAF as well as synchronously: on first mount the textarea can still be at its
  // pre-layout width (the flex row hasn't sized it yet), which wraps the placeholder over many
  // lines, inflates scrollHeight, and pins the box to its max height — an empty input rendering
  // as a ~220px void. Re-measuring after layout settles (and on resize) keeps it honest.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, isHero ? 220 : 160)}px`;
    };
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [text, isHero]);

  const canSend = text.trim().length > 0 && !busy && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSubmit(text.trim());
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        'group relative flex items-end gap-2 rounded-3xl border border-border bg-bg',
        // Resting: soft card lift, a transparent ring held in reserve so the focus
        // transition animates the colour rather than snapping a new box into place.
        'shadow-card ring-2 ring-transparent',
        'transition-all duration-200 ease-out',
        'hover:border-azure-200',
        // Focus: calm azure halo + firmer border + a gentle lift. Never a hard outline.
        'focus-within:border-azure-500 focus-within:ring-azure-500/25 focus-within:shadow-float',
        'focus-within:hover:border-azure-500',
        isHero ? 'p-3 pl-5' : 'p-2 pl-4',
        disabled && 'opacity-60',
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? (isHero ? 'Where do you want to go?' : 'Refine your trip…')}
        aria-label={isHero ? 'Describe your trip' : 'Refine your trip'}
        className={cn(
          'no-scrollbar w-full min-w-0 resize-none bg-transparent text-ink',
          'placeholder:text-ink-3 placeholder:font-normal',
          // The wrapper owns the focus affordance, so the field itself stays chrome-free.
          'focus:outline-none focus:ring-0',
          isHero ? 'py-2.5 text-lg leading-relaxed' : 'py-2 text-[15px] leading-relaxed',
        )}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl bg-azure-500 text-white',
          'transition-all duration-150 ease-out',
          'enabled:shadow-card enabled:hover:bg-azure-600 enabled:hover:shadow-float',
          'enabled:active:scale-95 enabled:active:shadow-card',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 disabled:shadow-none',
          isHero ? 'h-12 w-12 text-xl' : 'h-10 w-10 text-lg',
        )}
      >
        {busy ? <Spinner /> : <SendIcon />}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      role="status"
      aria-label="Working"
    />
  );
}
