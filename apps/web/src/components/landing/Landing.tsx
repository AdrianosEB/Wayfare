import { TopNav } from './TopNav';
import { Hero } from './Hero';
import { WhereToGo } from './WhereToGo';
import { ValueCards } from './ValueCards';
import { AllInOne } from './AllInOne';
import { TripTypeGrid } from './TripTypeGrid';
import { PartnerLogoRow, PressStrip } from './LogoStrips';
import { TestimonialCarousel } from './TestimonialCarousel';
import { FAQAccordion } from './FAQAccordion';
import { SiteFooter } from './SiteFooter';
import { useScrollToHash } from '@/lib/router';

/**
 * Marketing landing page (`/`) — modeled on layla.ai, re-skinned white + azure, photo-rich.
 * Composes the marketing sections in the order from docs/design/LANDING_PAGE.md. All copy,
 * presets, and imagery come from lib/content.ts + lib/images.ts; routing via lib/router.ts.
 */
export function Landing() {
  useScrollToHash();
  return (
    <div className="min-h-full bg-bg">
      <TopNav />
      <main>
        <Hero />
        <WhereToGo />
        <ValueCards />
        <AllInOne />
        <TripTypeGrid />
        <PartnerLogoRow />
        <PressStrip />
        <TestimonialCarousel />
        <FAQAccordion />
      </main>
      <SiteFooter />
    </div>
  );
}
