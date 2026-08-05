import type { BookingIntent, RankedOption } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * BookingAgent — stages bookings and hotel calls; it never executes them. This is a hard line,
 * not a TODO: completing a purchase, submitting a booking form, or placing a call is a
 * side-effect a human (or an explicitly approval-gated tool) must authorize. Every intent this
 * agent emits carries `status: "requires_approval"`.
 *
 * For stays where verification found a cheaper direct rate, it also drafts a phone-call script
 * — "call the hotel, ask them to match/beat the aggregator" — again as a staged intent, so the
 * human can decide to make the call. The agent models the recommendation; it does not dial.
 */

export function prepareBookings(
  selection: Record<string, RankedOption>,
  tracer: Tracer,
): BookingIntent[] {
  const intents: BookingIntent[] = [];

  for (const [kind, r] of Object.entries(selection)) {
    const o = r.option;
    if (o.verdict === "suspect") continue; // never stage a booking we don't trust

    intents.push({
      entity: o.entity,
      channel: "web_deeplink",
      listing: o.best,
      target: o.best.deepLink ?? o.best.source.url,
      callScript: [],
      status: "requires_approval",
      note: `Verified via ${o.sources.length} source(s) (confidence ${o.confidence.toFixed(2)}). Staged only — a human must confirm before anything is booked.`,
    });

    // a direct rate beats the aggregator → stage a call to lock it in.
    if (kind === "stay" && o.directDeal) {
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
        note: `Potential direct saving of ${d.savings} ${d.currency}. Call is drafted, NOT placed — requires the traveler's approval.`,
      });
    }
  }

  tracer.emit("booking", "staged", {
    intents: intents.length,
    channels: [...new Set(intents.map((i) => i.channel))],
  });
  return intents;
}
