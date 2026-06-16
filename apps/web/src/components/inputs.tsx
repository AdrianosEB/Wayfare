import { useMemo, useState } from 'react';
import type { Money, PartySize } from '@/types';
import { cn } from '@/lib/cn';
import { currencySymbol } from '@/lib/format';
import { CheckIcon, MinusIcon, PlusIcon, MapPinIcon } from './icons';

/* ----------------------------------------------------------------- ChipSelect --- */

export interface ChipSelectProps {
  options: { value: string; label: string }[];
  value: string | string[] | undefined;
  multi?: boolean;
  onChange: (value: string | string[]) => void;
}

export function ChipSelect({ options, value, multi, onChange }: ChipSelectProps) {
  const selected = (v: string) =>
    multi ? Array.isArray(value) && value.includes(v) : value === v;

  const toggle = (v: string) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    } else {
      onChange(v);
    }
  };

  return (
    <div role={multi ? 'group' : 'radiogroup'} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition',
              'focus-visible:ring-2',
              on
                ? 'border-primary bg-primary text-primary-fg shadow-card'
                : 'border-border bg-surface-2/60 text-muted hover:border-primary/40 hover:text-ink',
            )}
          >
            {on && <CheckIcon className="text-[14px]" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Stepper --- */

export interface StepperProps {
  value: PartySize | undefined;
  onChange: (value: PartySize) => void;
}

export function Stepper({ value, onChange }: StepperProps) {
  const v: PartySize = value ?? { adults: 1 };
  const set = (next: Partial<PartySize>) => onChange({ ...v, ...next });

  return (
    <div className="flex flex-col gap-3">
      <Counter
        label="Adults"
        min={1}
        value={v.adults}
        onChange={(n) => set({ adults: n })}
      />
      <Counter
        label="Children"
        min={0}
        value={v.children ?? 0}
        onChange={(n) => {
          const ages = (v.childAges ?? []).slice(0, n);
          while (ages.length < n) ages.push(8);
          set({ children: n, childAges: n > 0 ? ages : undefined });
        }}
      />
      {(v.children ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Ages:</span>
          {(v.childAges ?? []).map((age, i) => (
            <input
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              type="number"
              min={0}
              max={17}
              value={age}
              aria-label={`Child ${i + 1} age`}
              onChange={(e) => {
                const ages = [...(v.childAges ?? [])];
                ages[i] = Math.max(0, Math.min(17, Number(e.target.value) || 0));
                set({ childAges: ages });
              }}
              className="tabular w-14 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink focus:outline-none focus-visible:ring-2"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <RoundBtn
          label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <MinusIcon />
        </RoundBtn>
        <span className="tabular w-6 text-center text-base font-semibold text-ink">{value}</span>
        <RoundBtn label={`Increase ${label}`} onClick={() => onChange(value + 1)}>
          <PlusIcon />
        </RoundBtn>
      </div>
    </div>
  );
}

function RoundBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2/60',
        'text-ink transition hover:border-primary/50 focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- CityAutocomplete --- */

// Client-only suggestions — the client never geocodes directly (no key, only /api).
// A small built-in hub list keeps the input low-friction; free text is always allowed.
const HUBS = [
  'London',
  'Manchester',
  'Berlin',
  'Munich',
  'Paris',
  'Amsterdam',
  'Madrid',
  'Barcelona',
  'Rome',
  'Milan',
  'Athens',
  'Dublin',
  'New York',
  'Lisbon',
  'Vienna',
  'Zurich',
  'Copenhagen',
  'Stockholm',
];

export interface CityAutocompleteProps {
  value: string | undefined;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function CityAutocomplete({ value, placeholder, onChange }: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const text = value ?? '';
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return HUBS.slice(0, 6);
    return HUBS.filter((c) => c.toLowerCase().includes(q)).slice(0, 6);
  }, [text]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-primary/50">
        <MapPinIcon className="shrink-0 text-base text-faint" />
        <input
          value={text}
          placeholder={placeholder ?? 'e.g. London'}
          aria-label="City"
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
          {matches.map((c) => (
            <li key={c}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink"
              >
                <MapPinIcon className="text-sm text-faint" />
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ShortText --- */

export interface ShortTextProps {
  value: string | undefined;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function ShortText({ value, placeholder, onChange }: ShortTextProps) {
  return (
    <input
      value={value ?? ''}
      placeholder={placeholder}
      aria-label="Answer"
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-primary/50 focus:outline-none focus-visible:ring-2"
    />
  );
}

/* --------------------------------------------------------------- CurrencyInput --- */

export interface CurrencyInputProps {
  value: Money | undefined;
  placeholder?: string;
  currency?: string;
  onChange: (value: Money) => void;
}

export function CurrencyInput({
  value,
  placeholder,
  currency = 'EUR',
  onChange,
}: CurrencyInputProps) {
  const cur = value?.currency ?? currency;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-primary/50">
      <span className="text-base font-semibold text-muted">{currencySymbol(cur)}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value?.amount ?? ''}
        placeholder={placeholder ?? '2500'}
        aria-label="Budget amount"
        onChange={(e) => onChange({ amount: Number(e.target.value) || 0, currency: cur })}
        className="tabular w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ SkipControl --- */

export interface SkipControlProps {
  skipped: boolean;
  skipDefault?: string;
  onToggle: (skipped: boolean) => void;
}

/** Skip affordance that always shows the default it'll assume (US-2.3). */
export function SkipControl({ skipped, skipDefault, onToggle }: SkipControlProps) {
  if (skipped) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-muted">
          <CheckIcon className="text-[13px] text-primary" />
          {skipDefault ?? 'Using a sensible default'}
        </span>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="font-medium text-primary hover:underline focus-visible:ring-2"
        >
          Undo
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onToggle(true)}
      title={skipDefault}
      className="text-xs font-medium text-faint underline-offset-2 hover:text-muted hover:underline focus-visible:ring-2"
    >
      Skip{skipDefault ? ` — ${skipDefault}` : ''}
    </button>
  );
}
