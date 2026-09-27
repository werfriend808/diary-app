import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { placeNameFrom } from './placeName';

/*
 * "Use current location" in the editor: one position fix, turned into a neighbourhood name once, right
 * when the button is pressed. Nothing here runs on its own, coordinates never leave this function, and
 * only the name the user keeps is saved with the entry.
 *
 * The permission is asked for here, on the first press — never at launch. The app only declares
 * approximate location on Android (see app.json), and a neighbourhood needs no more than Balanced accuracy.
 */

export type PlaceLookup =
  | { ok: true; place: string }
  | { ok: false; reason: 'unavailable' | 'denied' | 'servicesOff' | 'notFound' };

/** A fix can take a while indoors; after this the user is better off typing. */
const FIX_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Never throws: every failure comes back as a reason the editor can show in a short note. */
export async function lookUpCurrentPlace(): Promise<PlaceLookup> {
  // expo-location has no reverse geocoding on web.
  if (Platform.OS === 'web') return { ok: false, reason: 'unavailable' };
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { ok: false, reason: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'servicesOff' };

    const { coords } = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      FIX_TIMEOUT_MS,
    );
    // Uses the phone's own geocoder (Apple's or Google's service); fails when offline.
    const [address] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
    const place = placeNameFrom(address);
    return place ? { ok: true, place } : { ok: false, reason: 'notFound' };
  } catch {
    // No fix in time, offline, geocoder missing on this device…: the user types the place instead.
    return { ok: false, reason: 'notFound' };
  }
}
