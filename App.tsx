import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { exportBackup, importBackup, removeOldBackupFiles } from './src/backup';
import MemoriesSection from './src/components/MemoriesSection';
import { todayKey, toKey } from './src/dates';
import { FONT_FILES } from './src/fonts';
import { applyLanguage, resolveLanguage, t } from './src/i18n';
import { isUnlocked, unlockTime } from './src/letters';
import { RELOCK_AFTER_MS } from './src/lock';
import { memoriesFor } from './src/memories';
import {
  cancelNotification,
  NotificationPermission,
  notificationPermission,
  onLetterNotificationTap,
  syncLetterNotifications,
  SyncResult,
} from './src/notifications';
import CalendarScreen from './src/screens/CalendarScreen';
import EditorScreen from './src/screens/EditorScreen';
import EntryListScreen from './src/screens/EntryListScreen';
import LetterComposerScreen from './src/screens/LetterComposerScreen';
import LetterReaderScreen from './src/screens/LetterReaderScreen';
import LettersScreen from './src/screens/LettersScreen';
import LicensesScreen from './src/screens/LicensesScreen';
import LockScreen from './src/screens/LockScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { loadSettings, saveSettings, Settings } from './src/settings';
import { deletedEntry, deletedLetter, isLive } from './src/records';
import { deletePhoto, loadEntries, loadLetters, newId, saveEntries, saveLetters } from './src/storage';
import { makeStyles, ThemeProvider, useTheme } from './src/theme';
import { Entry, Letter } from './src/types';

type Tab = 'list' | 'calendar' | 'letters';

/** Full-screen views that sit on top of the tabs. */
type Overlay =
  | { kind: 'entry'; entry: Entry; isNew: boolean }
  | { kind: 'compose' }
  | { kind: 'letter'; letter: Letter }
  | { kind: 'settings' }
  | { kind: 'licenses' }
  | null;

const TABS = [
  { key: 'list', icon: '📖', label: 'tabs.diary' },
  { key: 'calendar', icon: '📅', label: 'tabs.calendar' },
  { key: 'letters', icon: '✉️', label: 'tabs.letters' },
] as const satisfies readonly { key: Tab; icon: string; label: string }[];

interface Data {
  entries: Entry[];
  letters: Letter[];
}

// Keep the splash screen up until the fonts are ready, so text never appears in one font and then jumps.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
/** If the fonts take longer than this, open with the system fonts (they switch over once they arrive). */
const FONT_WAIT_MS = 4000;

/** Loads everything once, then renders the app inside the chosen theme. */
export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // A font that fails to load must never stop the app: it then opens with the system fonts.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const fontsSettled = fontsLoaded || !!fontError || fontWaitOver;
  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsSettled]);

  // If the diary can't be read, stop here: the app must not start empty and then save over it.
  const load = () => {
    setLoadFailed(false);
    Promise.all([loadEntries(), loadLetters(), loadSettings()]).then(
      ([entries, letters, s]) => {
        applyLanguage(resolveLanguage(s.language)); // before the first screen shows
        setSettings(s);
        setData({ entries, letters });
      },
      () => setLoadFailed(true),
    );
  };

  useEffect(() => {
    load();
    removeOldBackupFiles();
  }, []);

  const changeSettings = (s: Settings) => {
    // Every screen re-renders in the new language right away (they all use useTranslation).
    applyLanguage(resolveLanguage(s.language));
    setSettings(s);
    saveSettings(s).catch(warnSaveFailed);
  };

  if (!fontsSettled) return null; // the splash screen is still showing

  return (
    <SafeAreaProvider>
      <ThemeProvider pref={settings?.theme ?? 'system'} fontsReady={fontsLoaded}>
        {data && settings ? (
          <Main initial={data} settings={settings} onChangeSettings={changeSettings} />
        ) : loadFailed ? (
          <LoadFailed onRetry={load} />
        ) : (
          <Loading />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function warnSaveFailed() {
  Alert.alert(t('app.saveFailedTitle'), t('app.saveFailedBody'));
}

function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { colors, fonts } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
      <Text style={{ ...fonts.uiBold, fontSize: 20, color: colors.ink, textAlign: 'center' }}>
        {t('app.loadFailedTitle')}
      </Text>
      <Text style={{ ...fonts.ui, marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' }}>
        {t('app.loadFailedBody')}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 24, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 }}
      >
        <Text style={{ ...fonts.uiBold, color: '#fff', fontSize: 16 }}>{t('common.tryAgain')}</Text>
      </Pressable>
    </View>
  );
}

function Main({
  initial,
  settings,
  onChangeSettings,
}: {
  initial: Data;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
}) {
  const { isDark } = useTheme();
  const styles = useStyles();
  const { t, i18n } = useTranslation();

  // Everything stored, including deleted items (tombstones, see records.ts). Only change these here;
  // screens get the filtered `entries` / `letters` below.
  const [allEntries, setAllEntries] = useState(initial.entries);
  const [allLetters, setAllLetters] = useState(initial.letters);
  const entries = useMemo(() => allEntries.filter(isLive), [allEntries]);
  const letters = useMemo(() => allLetters.filter(isLive), [allLetters]);
  const [locked, setLocked] = useState(settings.lock);
  const [tab, setTab] = useState<Tab>('list');
  const [today, setToday] = useState(todayKey());
  const [selectedDay, setSelectedDay] = useState(today);
  const [overlay, setOverlay] = useState<Overlay>(null);
  // The moment letters are checked against (they open at an exact time, not just on a day).
  const [now, setNow] = useState(() => Date.now());
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>('undetermined');

  // When the app comes back: refresh "today" (it may be past midnight), and re-lock if it was away a while.
  const backgroundedAt = useRef<number | null>(null);
  const lockOn = useRef(settings.lock);
  lockOn.current = settings.lock;
  // With the lock on, cover the diary as soon as the app leaves the foreground, so the app switcher's
  // snapshot doesn't show it. (iOS takes the snapshot on 'inactive'; on Android this is best effort.)
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && lockOn.current) setCovered(true);
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        setCovered(false);
        setToday(todayKey());
        setNow(Date.now());
        onForeground();
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (lockOn.current && away > RELOCK_AFTER_MS) {
          // The screens stay mounted under the lock, so drop focus or the keyboard would type into them.
          Keyboard.dismiss();
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Also roll "today" over at midnight if the app is left open.
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setToday(todayKey()), midnight.getTime() - now.getTime() + 1000);
    return () => clearTimeout(timer);
  }, [today]);

  // Newest day first; within a day, newest written first.
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [entries],
  );
  const memories = useMemo(() => memoriesFor(entries, today), [entries, today]);
  const readyLetters = letters.filter((l) => !l.openedAt && isUnlocked(l, now)).length;

  // Tick `now` forward when the next sealed letter opens, so it shows up as ready without a restart.
  const nextUnlock = useMemo(() => {
    const upcoming = letters.filter((l) => !l.openedAt).map(unlockTime).filter((t) => t > now);
    return upcoming.length > 0 ? Math.min(...upcoming) : null;
  }, [letters, now]);
  useEffect(() => {
    if (nextUnlock === null) return;
    // setTimeout can't wait longer than ~24 days; for later letters it just ticks early and re-arms.
    const delay = Math.min(Math.max(nextUnlock - Date.now() + 500, 0), 2_000_000_000);
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [nextUnlock]);

  // ---- entries ----
  const commitEntries = (next: Entry[]) => {
    setAllEntries(next);
    saveEntries(next).catch(warnSaveFailed);
  };

  const startNewEntry = () => {
    const date = tab === 'calendar' && selectedDay <= today ? selectedDay : today;
    const now = Date.now();
    setOverlay({
      kind: 'entry',
      isNew: true,
      entry: { id: newId(), date, title: '', body: '', createdAt: now, updatedAt: now },
    });
  };

  const openEntry = (entry: Entry) => setOverlay({ kind: 'entry', entry, isNew: false });

  const saveEntry = (e: Entry) => {
    const exists = allEntries.some((x) => x.id === e.id);
    commitEntries(exists ? allEntries.map((x) => (x.id === e.id ? e : x)) : [e, ...allEntries]);
    setSelectedDay(e.date);
    setOverlay(null);
  };

  /** Deletes the photo file and leaves an emptied tombstone in place of the entry. */
  const deleteEntry = (id: string) => {
    const now = Date.now();
    deletePhoto(allEntries.find((x) => x.id === id)?.photoName);
    commitEntries(allEntries.map((x) => (x.id === id ? deletedEntry(x, now) : x)));
    setOverlay(null);
  };

  // ---- letters ----
  // Latest letters, for code that resumes after an await (the list may have changed meanwhile).
  const lettersRef = useRef(allLetters);
  const commitLetters = (next: Letter[]) => {
    lettersRef.current = next;
    setAllLetters(next);
    saveLetters(next).catch(warnSaveFailed);
  };

  /**
   * Stores the result of a notification sync: each upcoming letter's notification id (or none), and the
   * permission. A letter deleted or opened while the sync ran gets its fresh notification cancelled.
   */
  const applySync = ({ permission, ids }: SyncResult) => {
    setNotifyPermission(permission);
    const current = lettersRef.current;
    let changed = false;
    const next = current.map((l) => {
      const id = isLive(l) && !l.openedAt ? ids.get(l.id) : undefined;
      if (l.notificationId === id) return l;
      changed = true;
      const { notificationId, ...rest } = l;
      return id ? { ...rest, notificationId: id } : rest;
    });
    for (const [letterId, id] of ids) {
      const l = current.find((x) => x.id === letterId);
      if (!l || !isLive(l) || l.openedAt) cancelNotification(id);
    }
    if (changed) commitLetters(next);
  };

  /** Re-schedules notifications for the (up to 50) soonest letters still to open. */
  const syncNotifications = async (askPermission: boolean) =>
    applySync(await syncLetterNotifications(lettersRef.current, { askPermission }));

  // At app start: schedule the soonest letters again (fills the 50 slots as earlier letters open, and
  // replaces anything left from before). Never asks for permission here.
  const syncAtLaunch = useEffectEvent(() => {
    syncNotifications(false);
  });
  useEffect(() => syncAtLaunch(), []);

  // Back from the background: the phone's language may have changed (Android doesn't restart the app
  // for that), and notifications may have been switched on or off in the phone's settings.
  const onForeground = useEffectEvent(async () => {
    const languageChanged = applyLanguage(resolveLanguage(settings.language));
    // A language change re-syncs through the effect below.
    if (!languageChanged && (await notificationPermission()) !== notifyPermission) syncNotifications(false);
  });

  // Scheduled notifications keep the wording they were created with, so after a language change the
  // ones for letters still to open are scheduled again in the new language.
  const lastLanguage = useRef(i18n.language);
  const onLanguageChange = useEffectEvent(() => {
    if (lastLanguage.current === i18n.language) return;
    lastLanguage.current = i18n.language;
    syncNotifications(false);
  });
  useEffect(() => onLanguageChange(), [i18n.language]);

  // Tapping a letter's notification opens that letter.
  const openFromNotification = useEffectEvent((letterId: string) => {
    // Don't throw away an entry or letter that's being written; the letter waits on the Letters tab.
    if (overlay?.kind === 'entry' || overlay?.kind === 'compose') return;
    setNow(Date.now());
    setTab('letters');
    const letter = lettersRef.current.find((l) => l.id === letterId && isLive(l));
    if (letter && isUnlocked(letter, Date.now())) openLetter(letter);
  });
  useEffect(() => onLetterNotificationTap((id) => openFromNotification(id)), []);

  const sealLetter = async (body: string, opensAt: number) => {
    const now = Date.now();
    const opensOn = toKey(new Date(opensAt));
    const letter: Letter = { id: newId(), body, writtenOn: today, opensOn, opensAt, createdAt: now, updatedAt: now };
    commitLetters([...allLetters, letter]);
    setOverlay(null);
    setTab('letters');
    // Ask for notification permission after sealing, so the prompt makes sense in context.
    // If it's turned down the letter is still sealed; the Letters screen shows a short hint.
    await syncNotifications(true);
  };

  const openLetter = (letter: Letter) => {
    if (!isUnlocked(letter, Date.now())) return; // still sealed
    let shown = letter;
    if (!letter.openedAt) {
      const now = Date.now();
      shown = { ...letter, openedAt: now, updatedAt: now };
      commitLetters(allLetters.map((l) => (l.id === letter.id ? shown : l)));
    }
    setOverlay({ kind: 'letter', letter: shown });
  };

  /** Cancels the letter's notification and leaves an emptied tombstone in its place. */
  const deleteLetter = (id: string) => {
    const now = Date.now();
    cancelNotification(allLetters.find((l) => l.id === id)?.notificationId);
    commitLetters(allLetters.map((l) => (l.id === id ? deletedLetter(l, now) : l)));
  };

  // ---- backup ----
  const doExport = async () => {
    try {
      await exportBackup(allEntries, allLetters); // backup.ts decides what goes in (no tombstones)
    } catch (e) {
      Alert.alert(t('backup.exportFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    }
  };

  const doImport = async () => {
    try {
      // Tombstones included, so a restored item replaces its tombstone instead of duplicating the id.
      const result = await importBackup({ entries: allEntries, letters: allLetters });
      if (!result) return;
      commitEntries(result.entries);
      commitLetters(result.letters);
      // Re-schedule every letter still to open, including the imported ones, without duplicates.
      await syncNotifications(true);
      const summary =
        result.addedEntries + result.addedLetters === 0
          ? t('backup.nothingNew')
          : t('backup.added', {
              entries: t('backup.entries', { count: result.addedEntries }),
              letters: t('backup.letters', { count: result.addedLetters }),
            });
      const skippedNote = result.skipped > 0 ? ` ${t('backup.skipped', { count: result.skipped })}` : '';
      Alert.alert(t('backup.restored'), summary + skippedNote);
    } catch (e) {
      Alert.alert(t('backup.importFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    }
  };

  // ---- render ----
  const renderOverlay = () => {
    if (!overlay) return null;
    switch (overlay.kind) {
      case 'entry':
        return (
          <EditorScreen
            key={overlay.entry.id}
            original={overlay.entry}
            isNew={overlay.isNew}
            onSave={saveEntry}
            onDelete={deleteEntry}
            onClose={() => setOverlay(null)}
          />
        );
      case 'compose':
        return <LetterComposerScreen today={today} onSeal={sealLetter} onClose={() => setOverlay(null)} />;
      case 'letter':
        return <LetterReaderScreen letter={overlay.letter} onClose={() => setOverlay(null)} />;
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onChange={onChangeSettings}
            onExport={doExport}
            onImport={doImport}
            onOpenLicenses={() => setOverlay({ kind: 'licenses' })}
            onClose={() => setOverlay(null)}
          />
        );
      case 'licenses':
        return <LicensesScreen onClose={() => setOverlay({ kind: 'settings' })} />;
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* The lock covers the app instead of replacing it, so a half-written entry survives re-locking. */}
      <View
        style={{ flex: 1 }}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={locked}
      >
        {overlay ? (
          renderOverlay()
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.appTitle}>{tab === 'letters' ? t('letters.title') : t('app.title')}</Text>
              <View style={styles.headerRight}>
                {tab !== 'letters' && (
                  <Text style={styles.count}>
                    {t('app.entryCount', { count: entries.length })}
                  </Text>
                )}
                <Pressable
                  onPress={() => setOverlay({ kind: 'settings' })}
                  hitSlop={12}
                  accessibilityLabel={t('app.settings')}
                >
                  <Text style={styles.gear}>⚙︎</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              {tab === 'list' && (
                <EntryListScreen
                  entries={sorted}
                  onOpen={openEntry}
                  header={
                    <MemoriesSection
                      memories={memories}
                      readyLetters={readyLetters}
                      hasEntries={entries.length > 0}
                      onOpen={openEntry}
                      onOpenLetters={() => setTab('letters')}
                    />
                  }
                />
              )}
              {tab === 'calendar' && (
                <CalendarScreen
                  entries={sorted}
                  today={today}
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  onOpen={openEntry}
                />
              )}
              {tab === 'letters' && (
                <LettersScreen
                  letters={letters}
                  today={today}
                  now={now}
                  notificationsOff={notifyPermission === 'denied'}
                  onWrite={() => setOverlay({ kind: 'compose' })}
                  onOpen={openLetter}
                  onDelete={deleteLetter}
                />
              )}

              {tab !== 'letters' && (
                <Pressable
                  onPress={startNewEntry}
                  style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
                  accessibilityLabel={t('app.newEntry')}
                >
                  <Text style={styles.fabText}>＋</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.tabBar}>
              {TABS.map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.tab}
                  onPress={() => {
                    setTab(item.key);
                    setNow(Date.now()); // fresh countdowns on the Letters tab
                  }}
                >
                  <View>
                    <Text style={styles.tabIcon}>{item.icon}</Text>
                    {item.key === 'letters' && readyLetters > 0 && <View style={styles.badge} />}
                  </View>
                  <Text style={[styles.tabLabel, tab === item.key && styles.tabActive]}>{t(item.label)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      {locked && (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen onUnlocked={() => setLocked(false)} />
        </View>
      )}

      {covered && (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <Text style={styles.coverIcon}>🔒</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, fonts }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    appTitle: { ...fonts.uiHeavy, fontSize: 30, color: colors.ink },
    count: { ...fonts.ui, fontSize: 14, color: colors.muted },
    gear: { fontSize: 24, color: colors.muted },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      backgroundColor: colors.card,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    tabIcon: { fontSize: 20 },
    badge: {
      position: 'absolute',
      top: 0,
      right: -6,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
    tabLabel: { ...fonts.ui, fontSize: 12, color: colors.muted, marginTop: 2 },
    tabActive: { ...fonts.uiBold, color: colors.accent },
    cover: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    coverIcon: { fontSize: 48 },
  }),
);
