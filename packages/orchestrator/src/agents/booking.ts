import type { BookingIntent, ItineraryLeg } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * Stages bookings and hotel calls for the chosen itinerary. It never executes them: every
 * intent carries `status: "requires_approval"` and a human (or an approval-gated tool) has to
 * authorize the purchase, form submission or call.
 *
 * For a stay with a cheaper direct rate it also drafts a phone-call script as a staged intent.
 */

export function prepareBookings(legs: ItineraryLeg[], tracer: Tracer): BookingIntent[] {
  const intents: BookingIntent[] = [];

  for (const leg of legs) {
    const o = leg.option;
    if (o.verdict === "suspect") continue; // never stage a booking we don't trust

    intents.push({
      entity: o.entity,
      channel: "web_deeplink",
      listing: o.best,
      target: o.best.deepLink ?? o.best.source.url,
      callScript: [],
      status: "requires_approval",
      note: `Verified via ${o.sources.length} source(s) (confidence ${o.confidence.toFixed(2)}). Staged only. A human must confirm before anything is booked.`,
    });

    // a direct rate beats the aggregator → stage a call to lock it in.
    if (leg.kind === "stay" && o.directDeal) {
      const d = o.directDeal;
      intents.push({
        entity: o.entity,
        channel: "phone_call",
        listing: o.best,
        callScript: [
          `Ask ${o.entity.name} to confirm availability for the dates.`,
          `Reference the direct rate of ${d.directPrice} ${d.currency} vs ${d.aggregatorPrice} ${d.currency} on ${d.aggregatorSource}.`,
          `Ask them to match or beat the aggregator and waive the booking fee.`,
        ],
        status: "requires_approval",
        note: `Potential direct saving of ${d.savings} ${d.currency}. Call is drafted, not placed. It requires the traveler's approval.`,
      });
    }
  }

  tracer.emit("booking", "staged", {
    intents: intents.length,
    channels: [...new Set(intents.map((i) => i.channel))],
  });
  return intents;
}
