import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { lookUpCurrentPlace } from '../location';
import { canLock, unlock } from '../lock';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../settings';

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(async () => 3),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 37.54, longitude: 127.05 } })),
  reverseGeocodeAsync: jest.fn(async () => [{ region: '서울특별시', subregion: '성동구', district: '성수동' }]),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const loc = Location as jest.Mocked<typeof Location>;

describe('settings', () => {
  it('starts from the defaults', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads, filling in settings added in later versions from the defaults', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', lock: true });
    await expect(loadSettings()).resolves.toEqual({ theme: 'dark', lock: true, language: 'system' });

    await AsyncStorage.setItem('diary.settings.v1', JSON.stringify({ theme: 'light' })); // older version
    await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
  });

  it('assumes the lock was on when settings cannot be read (fail closed)', async () => {
    await AsyncStorage.setItem('diary.settings.v1', '{broken');
    await expect(loadSettings()).resolves.toMatchObject({ lock: true });
  });
});

describe('app lock', () => {
  it('is available only when the phone has some screen lock set up', async () => {
    await expect(canLock()).resolves.toBe(true);
    auth.getEnrolledLevelAsync.mockResolvedValueOnce(0);
    await expect(canLock()).resolves.toBe(false);
    auth.getEnrolledLevelAsync.mockRejectedValueOnce(new Error('x'));
    await expect(canLock()).resolves.toBe(false);
  });

  it('unlocks only on successful authentication', async () => {
    await expect(unlock()).resolves.toBe(true);
    auth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await expect(unlock()).resolves.toBe(false);
    auth.authenticateAsync.mockRejectedValueOnce(new Error('x'));
    await expect(unlock()).resolves.toBe(false);
  });

  it('never locks the owner out when the phone’s own screen lock was removed', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValueOnce(0);
    await expect(unlock()).resolves.toBe(true);
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(3); // only the calls from the test above
  });
});

describe('current place lookup', () => {
  it('turns the position into a neighbourhood name', async () => {
    await expect(lookUpCurrentPlace()).resolves.toEqual({ ok: true, place: '서울특별시 성동구 성수동' });
  });

  it.each([
    ['denied', () => loc.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false } as never)],
    ['servicesOff', () => loc.hasServicesEnabledAsync.mockResolvedValueOnce(false)],
    ['notFound', () => loc.reverseGeocodeAsync.mockResolvedValueOnce([])],
    ['notFound', () => loc.getCurrentPositionAsync.mockRejectedValueOnce(new Error('offline'))],
  ])('reports "%s" instead of throwing', async (reason, arrange) => {
    arrange();
    await expect(lookUpCurrentPlace()).resolves.toEqual({ ok: false, reason });
  });

  it('gives up when no position fix arrives in time', async () => {
    jest.useFakeTimers();
    loc.getCurrentPositionAsync.mockReturnValueOnce(new Promise(() => {}));
    const result = lookUpCurrentPlace();
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toEqual({ ok: false, reason: 'notFound' });
    jest.useRealTimers();
  });
});
