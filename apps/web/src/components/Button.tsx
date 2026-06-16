import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The azure button system — docs/design/TOKENS.md §4 + COMPONENTS.md.
 * One primary azure CTA per view; never stack azure buttons.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-azure-500 text-white hover:bg-azure-600 shadow-card',
  secondary: 'bg-bg text-ink border border-border hover:bg-surface',
  ghost: 'bg-transparent text-azure-700 hover:bg-azure-50',
  pill: 'bg-azure-50 text-azure-700 hover:bg-azure-100',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-[52px] px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', iconLeft, iconRight, loading = false, disabled, className, children, ...rest },
  ref,
) {
  const radius = variant === 'pill' ? 'rounded-pill' : 'rounded-pill';
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 font-semibold leading-none',
        'transition focus-visible:ring-2 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100',
        radius,
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className="absolute h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          role="status"
          aria-label="Working"
        />
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
    </button>
  );
});
