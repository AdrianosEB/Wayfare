/**
 * Frontend-supplied imagery. See docs/design/COMPONENTS.md "Imagery".
 *
 * The wire contract carries no image fields. Components take a plain `image: string` prop
 * and the screen layer fills it with `images.for(key)`. If the backend later carries
 * `imageUrl`, only this file and the call sites change. Do not add an image field to
 * @wayfare/shared, the server or the fixtures.
 *
 * Keys are loose (destination name, trip vibe, stay/activity category). They are normalized
 * and resolved against a curated set; unknown keys fall back deterministically to one of a
 * few default photos.
 */

const W = 1200;
const Q = 70;
const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${W}&q=${Q}`;

/** Curated destination / lifestyle photography. */
const CURATED: Record<string, string> = {
  // destinations
  greece: u('1533105079780-92b9be482077'),
  naxos: u('1533105079780-92b9be482077'),
  santorini: u('1570077188670-e3a8d69ac5ff'),
  lisbon: u('1585208798174-6cedd86e019a'),
  kyoto: u('1545569341-9eb8b30979d9'),
  japan: u('1545569341-9eb8b30979d9'),
  amalfi: u('1534445867742-43195f401b6c'),
  italy: u('1534445867742-43195f401b6c'),
  paris: u('1502602898657-3e91760cbb34'),
  barcelona: u('1583422409516-2895a77efded'),
  valencia: u('1583422409516-2895a77efded'),
  // Aegean set for the /collection chapters. scripts/build-lqip.sh checks that each one
  // still returns 200.
  aegean_port: u('1603182673190-4270225080e0'),
  aegean_table: u('1639244132045-94c307ff4bfc'),
  cyclades_alley: u('1630490866118-5805daf1954d'),
  aegean_terrace: u('1537182534312-f945134cce34'),

  // budget showcase destinations
  sofia: u('1601581875309-fafbf2d3ed3a'),
  // The previous ID (…-799462dc3b3a) had a corrupted suffix and 404'd, so the fallback
  // served Kraków a Santorini photo.
  krakow: u('1606992894456-799462dacd65'),
  budapest: u('1565426873118-a17ed65d74b9'),
  prague: u('1541849546-216549ae216d'),
  porto: u('1555881400-74d7acaacd8b'),
  naples: u('1518730518541-d0843268c287'),
  athens: u('1555993539-1732b0258235'),

  // trip vibes / types
  couple: u('1518621736915-f3b1c41bfd00'),
  family: u('1502086223501-7ea6ecd79368'),
  solo: u('1488646953014-85cb44e25828'),
  weekend: u('1502602898657-3e91760cbb34'),
  roadtrip: u('1469854523086-cc02fe5d8800'),
  group: u('1530789253388-582c481c54b0'),
  luxury: u('1571896349842-33c89424de2d'),
  bleisure: u('1486406146926-c627a92ad1ab'),

  // categories (stays / activities)
  beach: u('1507525428034-b723cf961d3e'),
  city: u('1486406146926-c627a92ad1ab'),
  hotel: u('1582719478250-c89cae4dc85b'),
  stay: u('1582719478250-c89cae4dc85b'),
  boat_trip: u('1544551763-46a013bb70d5'),
  boat: u('1544551763-46a013bb70d5'),
  food: u('1414235077428-338989a2e8c0'),
  meal: u('1414235077428-338989a2e8c0'),
  // Previous ID 404'd (same corrupted suffix as krakow).
  museum: u('1498473956271-69e18b4dde5a'),
  ruins: u('1555993539-1732b0258235'),
  viewpoint: u('1502602898657-3e91760cbb34'),
  hike: u('1551632811-561732d1e306'),
  sunset: u('1495616811223-4d98c6e9c869'),
  nightlife: u('1514525253161-7a46d19cd819'),
  flight: u('1436491865332-7a61a109cc05'),
  ferry: u('1559827260-dc66d52bef19'),
  transit: u('1559827260-dc66d52bef19'),
  walk: u('1502602898657-3e91760cbb34'),
};

/** Deterministic fallback pool. */
const DEFAULT_IMG = u('1507525428034-b723cf961d3e'); // sun-soaked beach
const FALLBACKS: string[] = [
  CURATED.beach ?? DEFAULT_IMG,
  CURATED.greece ?? DEFAULT_IMG,
  CURATED.lisbon ?? DEFAULT_IMG,
  CURATED.amalfi ?? DEFAULT_IMG,
  CURATED.city ?? DEFAULT_IMG,
];

function normalize(key: string): string {
  return key.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const images = {
  /** Resolve any key (destination / vibe / category) to a curated photo URL. */
  for(key: string): string {
    const k = normalize(key);
    const direct = CURATED[k];
    if (direct) return direct;
    // try the first token (e.g. "naxos, greece" → "naxos")
    const first = k.split(/[_,]/)[0] ?? '';
    const byFirst = CURATED[first];
    if (byFirst) return byFirst;
    return FALLBACKS[hash(k) % FALLBACKS.length] ?? DEFAULT_IMG;
  },

  /**
   * Pick an image key for an itinerary item by keyword-matching its title, falling back to
   * the item kind. Used for the activity thumbnails in the day timeline.
   */
  categoryFor(title: string, kind: string): string {
    const t = title.toLowerCase();
    const rules: [RegExp, string][] = [
      [/beach|swim|cove|lagoon/, 'beach'],
      [/boat|cruise|sail|kayak|snorkel/, 'boat'],
      [/ferry/, 'ferry'],
      [/flight|fly|airport|→/, kind === 'transit' ? 'transit' : 'flight'],
      [/museum|gallery|exhibit/, 'museum'],
      [/temple|ruin|acropolis|castle|palace|ancient|archaeolog/, 'ruins'],
      [/hike|trail|trek|mountain|gorge|walk/, 'hike'],
      [/sunset|sunrise/, 'sunset'],
      [/view|panoram|lookout|miradouro/, 'viewpoint'],
      [/hotel|studio|stay|check-in|check in|apartment|villa|\bnights?\b/, 'stay'],
      [/dinner|lunch|breakfast|taverna|food|eat|restaurant|tasting|meze/, 'food'],
      [/\bbar\b|club|nightlife|drinks|evening|\bnight\b/, 'nightlife'],
    ];
    for (const [re, key] of rules) if (re.test(t)) return key;
    if (kind === 'meal') return 'food';
    if (kind === 'transit') return 'transit';
    if (kind === 'activity') return 'beach';
    return 'city';
  },

  /** Deterministic azure gradient, used as a CLS-safe placeholder / onError fallback. */
  gradient(key: string): string {
    const hues = [
      'linear-gradient(135deg, #5C9CF0, #2F80ED)',
      'linear-gradient(135deg, #AFCFFB, #5C9CF0)',
      'linear-gradient(135deg, #2F80ED, #1A5FBF)',
      'linear-gradient(135deg, #D6E6FD, #5C9CF0)',
    ];
    return hues[hash(normalize(key)) % hues.length] ?? hues[0]!;
  },
};
