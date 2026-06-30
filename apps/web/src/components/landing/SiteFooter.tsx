import type { ReactNode } from 'react';
import { Wordmark } from '@/components/Wordmark';
import { navigate, planHref } from '@/lib/router';
import { MARKETING } from '@/lib/content';

/**
 * SiteFooter — white footer with a hairline top border. Product / Company / Legal /
 * Top destinations link columns, a wordmark + social icons, and the signoff. Links that map
 * to real routes navigate; placeholders are inert anchors.
 */

interface FooterLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Plan a trip', onClick: () => navigate(planHref()) },
      { label: 'Explore trips', onClick: () => navigate('/explore') },
      { label: 'Budget trips', onClick: () => navigate('/pricing') },
    ],
  },
  {
    title: 'Company',
    links: [{ label: 'About', href: '#' }, { label: 'Blog', href: '#' }],
  },
  {
    title: 'Legal',
    links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }],
  },
  {
    title: 'Top destinations',
    links: [
      { label: 'Greece', onClick: () => navigate(planHref({ seed: 'Plan a trip to Greece', autostart: true })) },
      { label: 'Lisbon', onClick: () => navigate(planHref({ seed: 'Plan a trip to Lisbon', autostart: true })) },
      { label: 'Kyoto', onClick: () => navigate(planHref({ seed: 'Plan a trip to Kyoto', autostart: true })) },
      { label: 'Amalfi Coast', onClick: () => navigate(planHref({ seed: 'Plan a trip to the Amalfi Coast', autostart: true })) },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-site px-6 py-14">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Wordmark />
            <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-ink-2">
              Your money-aware travel sidekick.
            </p>
            <div className="mt-4 flex gap-2">
              <Social label="Wayfare on X" href="#">
                <path d="M4 4l16 16M20 4 4 20" />
              </Social>
              <Social label="Wayfare on Instagram" href="#">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="3.5" />
                <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" stroke="none" />
              </Social>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{col.title}</h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="rounded text-sm text-ink-2 transition hover:text-ink focus-visible:ring-2"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="rounded text-sm text-ink-2 transition hover:text-ink focus-visible:ring-2"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-sm text-ink-3">{MARKETING.footerSignoff}</p>
        </div>
      </div>
    </footer>
  );
}

function Social({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border text-ink-2 transition hover:bg-surface hover:text-ink focus-visible:ring-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </a>
  );
}
