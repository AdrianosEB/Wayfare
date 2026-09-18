import { useEffect, useId, useRef, type RefObject } from 'react';
import { BookingForm } from './BookingForm';

/**
 * The booking panel — a modal over the page.
 *
 * It never navigates on open and never touches scroll position, so the chapter you were
 * reading is still there behind it and still there when you close it.
 *
 * Scroll lock is `overflow: hidden` on <body> plus scrollbar-width compensation, NOT the
 * common `position: fixed; top: -scrollY` trick. That trick works, but it detaches the body
 * and then restores it, and any rounding error shows up as the page jumping — exactly the
 * "do not reset scroll" failure it is meant to prevent.
 *
 * No date picker. What a traveller books here is a plan, and the dates come out of the
 * planning conversation rather than a calendar that would have to imply availability we do
 * not have. `when` is deliberately free text.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional explicit focus-return target. Normally omitted: the panel remembers whatever was
   * focused when it opened, which is what you want now that several different controls can
   * open it rather than one Book button in the bar.
   */
  returnFocusTo?: RefObject<HTMLElement>;
}

export function BookingPanel({ open, onClose, returnFocusTo }: BookingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  // Lock background scroll without moving it.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  // ESC to close, Tab cycles within the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  // Move focus in on open, and hand it back to the opener on close.
  //
  // The opener is captured here rather than passed in: at the moment this effect runs the
  // clicked control is still the active element, so whichever prompt opened the panel gets
  // focus back. An explicit `returnFocusTo` still wins if a caller provides one.
  useEffect(() => {
    if (!open) return;
    const opener =
      returnFocusTo?.current ?? (document.activeElement as HTMLElement | null);
    firstFieldRef.current?.focus();
    return () => opener?.focus();
  }, [open, returnFocusTo]);

  if (!open) return null;


  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close booking panel"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto border-t border-border bg-bg p-6 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(30rem,100%)] sm:border-l sm:border-t-0 sm:p-10"
      >
        <div className="mb-8 flex items-start justify-between gap-6">
          <h2 id={titleId} className="font-display text-2xl font-semibold text-ink">
            Book a trip
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-2 py-1 text-sm text-ink-2 transition hover:text-ink focus-visible:ring-2"
          >
            Close
          </button>
        </div>

        <BookingForm idPrefix="panel" ref={firstFieldRef} />
      </div>
    </div>
  );
}

