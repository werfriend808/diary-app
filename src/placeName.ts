/*
 * Turns a reverse-geocoding result into a short neighbourhood name for an entry, like "서울특별시 성동구
 * 성수동" or "California San Francisco Mission". Kept free of React Native imports so it can be checked
 * with plain Node (src/placeName.examples.ts).
 *
 * The result comes back in the phone's language, and iOS and Android fill the fields differently (iOS
 * often repeats the city in region and city; Android tends to put the 구 in subregion). So nothing
 * language-specific is added or trimmed here: the filled fields are taken largest to smallest, repeats
 * are dropped, and at most three are kept. The user can edit the result before saving.
 */

/** The fields of expo-location's LocationGeocodedAddress this uses (all may be null or missing). */
export interface GeocodedAddress {
  region?: string | null;
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
  formattedAddress?: string | null;
}

/** Longest place name kept, here and when importing a backup. */
export const MAX_PLACE_LENGTH = 80;

const clean = (v: string | null | undefined) => (typeof v === 'string' ? v.trim() : '');

/** Returns '' when nothing usable came back; the user then types the place themselves. */
export function placeNameFrom(address: GeocodedAddress | null | undefined): string {
  if (!address) return '';
  const parts: { field: keyof GeocodedAddress; value: string }[] = [];
  for (const field of ['region', 'city', 'subregion', 'district'] as const) {
    const value = clean(address[field]);
    if (value && !parts.some((p) => p.value === value)) parts.push({ field, value });
  }
  // Four different values (e.g. state, city, county, neighbourhood): the neighbourhood is the point,
  // so the county-level subregion is the one to go.
  const kept = parts.length > 3 ? parts.filter((p) => p.field !== 'subregion') : parts;
  const name = kept.map((p) => p.value).join(' ') || clean(address.formattedAddress) || clean(address.name);
  return name.slice(0, MAX_PLACE_LENGTH);
}
