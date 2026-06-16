import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { XIcon } from './icons';

/**
 * Chip / pill — docs/design/COMPONENTS.md. Example prompts, quick-refine, trip-type,
 * multi-select answers, saving hints. Idle azure-50/azure-700 → hover azure-100; selected
 * fills azure-500 white.
 */
export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  as?: 'button' | 'span';
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  as,
  icon,
  className,
  disabled,
  ...rest
}: ChipProps) {
  const Tag = (as ?? (onClick ? 'button' : 'span')) as 'button' | 'span';
  const interactive = Tag === 'button';
  return (
    <Tag
      {...(interactive ? { type: 'button', onClick, disabled } : {})}
      aria-pressed={interactive && onClick ? selected : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3.5 text-sm font-medium leading-none',
        'h-9 transition',
        selected
          ? 'bg-azure-500 text-white'
          : 'bg-azure-50 text-azure-700',
        interactive && !selected && 'hover:bg-azure-100',
        interactive && 'focus-visible:ring-2 disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
          className="-mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:ring-2"
        >
          <XIcon className="text-[13px]" />
        </button>
      )}
    </Tag>
  );
}
