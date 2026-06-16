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
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, isHero ? 220 : 160)}px`;
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
        'group flex items-end gap-2 rounded-3xl border border-border bg-bg',
        'shadow-card transition focus-within:border-azure-400 focus-within:shadow-float',
        isHero ? 'p-2.5 pl-5' : 'p-2 pl-4',
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
          'no-scrollbar w-full resize-none bg-transparent py-2 text-ink placeholder:text-ink-3',
          'focus:outline-none',
          isHero ? 'text-lg leading-relaxed' : 'text-[15px] leading-relaxed',
        )}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl bg-azure-500 text-white',
          'transition enabled:hover:bg-azure-600 enabled:active:scale-95',
          'disabled:cursor-not-allowed disabled:opacity-40',
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
