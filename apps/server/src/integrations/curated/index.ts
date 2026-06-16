import type { Flight, Stay, Activity, Listing } from "@wayfare/shared";
import type { FlightQuery, StayQuery, ActivityQuery } from "../provider.js";
import type { MockContext } from "../listingFactory.js";
import type { TripRequest } from "@wayfare/shared";
import * as greece from "./greece.js";

/**
 * Curated "hero" destinations — hand-authored data packs with rich, realistic listings. They
 * power the best demos and act as ground-truth (the Greek-islands journey lives here). For
 * everything else, the procedural generator takes over (see ../mock/*). This is how we square
 * "global" with "mock-first": curated where it shines, procedural everywhere else.
 */

/** An intra-region transfer (e.g. a ferry) the assembler places on arrival/departure days. */
export interface TransitLeg {
  placement: "arrival" | "departure";
  title: string;
  startTime?: string;
  endTime?: string;
  listing: Listing;
}

export interface CuratedPack {
  id: string;
  /** does this pack own the given (possibly vague) destination string? */
  matches(destination: string): boolean;
  /** resolve a region/vibe to a concrete place + a one-line justification. */
  resolve(request: TripRequest): { destinationResolved: string; reason: string };
  buildFlights(q: FlightQuery, ctx: MockContext): Flight[];
  buildStays(q: StayQuery, ctx: MockContext): Stay[];
  buildActivities(q: ActivityQuery, ctx: MockContext): Activity[];
  /** intra-region transit (ferries/transfers); empty for packs that don't need it. */
  buildTransit(q: { location: string; partySize: number }, ctx: MockContext): TransitLeg[];
}

const PACKS: CuratedPack[] = [greece.pack];

export function findCuratedPack(destination: string): CuratedPack | undefined {
  return PACKS.find((p) => p.matches(destination));
}
