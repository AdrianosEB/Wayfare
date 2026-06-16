import { hashStr } from "../rng.js";

/**
 * Geography: airport codes, coordinates, and great-circle distance — the basis of procedural
 * flight pricing. Known cities use a real-ish table; anything else gets stable pseudo-coords
 * derived from the name hash, so distances (and therefore prices) are deterministic globally.
 */

export interface Place {
  name: string;
  iata: string;
  lat: number;
  lng: number;
}

const KNOWN: Record<string, Place> = {
  london: { name: "London", iata: "LGW", lat: 51.15, lng: -0.18 },
  gatwick: { name: "London Gatwick", iata: "LGW", lat: 51.15, lng: -0.18 },
  heathrow: { name: "London Heathrow", iata: "LHR", lat: 51.47, lng: -0.45 },
  manchester: { name: "Manchester", iata: "MAN", lat: 53.35, lng: -2.27 },
  berlin: { name: "Berlin", iata: "BER", lat: 52.36, lng: 13.5 },
  paris: { name: "Paris", iata: "CDG", lat: 49.0, lng: 2.55 },
  amsterdam: { name: "Amsterdam", iata: "AMS", lat: 52.31, lng: 4.76 },
  madrid: { name: "Madrid", iata: "MAD", lat: 40.47, lng: -3.56 },
  barcelona: { name: "Barcelona", iata: "BCN", lat: 41.3, lng: 2.08 },
  valencia: { name: "Valencia", iata: "VLC", lat: 39.49, lng: -0.48 },
  rome: { name: "Rome", iata: "FCO", lat: 41.8, lng: 12.25 },
  athens: { name: "Athens", iata: "ATH", lat: 37.94, lng: 23.95 },
  santorini: { name: "Santorini", iata: "JTR", lat: 36.4, lng: 25.48 },
  naxos: { name: "Naxos", iata: "JNX", lat: 37.08, lng: 25.37 },
  mykonos: { name: "Mykonos", iata: "JMK", lat: 37.43, lng: 25.35 },
  milos: { name: "Milos", iata: "MLO", lat: 36.7, lng: 24.47 },
  greece: { name: "Greece", iata: "ATH", lat: 37.98, lng: 23.73 },
  lisbon: { name: "Lisbon", iata: "LIS", lat: 38.77, lng: -9.13 },
  porto: { name: "Porto", iata: "OPO", lat: 41.25, lng: -8.68 },
  vienna: { name: "Vienna", iata: "VIE", lat: 48.11, lng: 16.57 },
  prague: { name: "Prague", iata: "PRG", lat: 50.1, lng: 14.26 },
  copenhagen: { name: "Copenhagen", iata: "CPH", lat: 55.62, lng: 12.65 },
};

const normalize = (s: string) => s.trim().toLowerCase();

/** Derive a stable pseudo-IATA from a place name (uppercase first 3 letters, padded). */
function pseudoIata(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3);
  return (letters + "XXX").slice(0, 3);
}

/** Stable pseudo-coordinates for unknown places (spread over a plausible band). */
function pseudoPlace(name: string): Place {
  const h = hashStr(normalize(name));
  const lat = ((h % 12000) / 100) - 55; // roughly -55..65
  const lng = (((h >>> 12) % 36000) / 100) - 180; // -180..180
  return { name, iata: pseudoIata(name), lat, lng };
}

export function resolvePlace(input: string): Place {
  const key = normalize(input);
  // direct hit
  if (KNOWN[key]) return KNOWN[key];
  // substring hit (e.g. "Naxos, Greece" → naxos; "flying from London" → london)
  for (const [k, v] of Object.entries(KNOWN)) {
    if (key.includes(k)) return v;
  }
  return pseudoPlace(input);
}

const R = 6371; // km
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km between two places. */
export function distanceKm(a: Place, b: Place): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
