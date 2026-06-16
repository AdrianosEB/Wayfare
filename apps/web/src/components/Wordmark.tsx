import { cn } from '@/lib/cn';

/** Wayfare wordmark — azure pin mark + name. Used in the planner top bar and landing nav. */
export function Wordmark({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-azure-500 text-white"
        aria-hidden
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span
        className={cn(
          'font-display text-lg font-semibold tracking-tight',
          onLight ? 'text-white' : 'text-ink',
        )}
      >
        Wayfare
      </span>
    </span>
  );
}
