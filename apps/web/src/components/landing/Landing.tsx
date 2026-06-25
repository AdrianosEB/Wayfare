import { TopNav } from './TopNav';
import { Hero } from './Hero';
import { WhereToGo } from './WhereToGo';
import { ValueCards } from './ValueCards';
import { AllInOne } from './AllInOne';
import { TripTypeGrid } from './TripTypeGrid';
import { LowPricing } from './LowPricing';
import { PastTrips } from './PastTrips';
import { PartnerLogoRow, PressStrip } from './LogoStrips';
import { TestimonialCarousel } from './TestimonialCarousel';
import { FAQAccordion } from './FAQAccordion';
import { SiteFooter } from './SiteFooter';
import { useScrollToHash } from '@/lib/router';

/**
 * Marketing landing page (`/`) — modeled on layla.ai, re-skinned white + azure, photo-rich.
 * The page is explored by scrolling (the nav has no jump-tabs): Hero → how it works →
 * trip types → budget trips → recently planned → social proof → FAQ. All copy, presets, and
 * imagery come from lib/content.ts + lib/images.ts; routing via lib/router.ts.
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
        <LowPricing />
        <PastTrips />
        <PartnerLogoRow />
        <PressStrip />
        <TestimonialCarousel />
        <FAQAccordion />
      </main>
      <SiteFooter />
    </div>
  );
}
