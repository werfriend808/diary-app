import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { exportBackup, importBackup } from './src/backup';
import MemoriesSection from './src/components/MemoriesSection';
import { todayKey } from './src/dates';
import { RELOCK_AFTER_MS } from './src/lock';
import { memoriesFor } from './src/memories';
import { cancelNotification, scheduleLetterNotification } from './src/notifications';
import CalendarScreen from './src/screens/CalendarScreen';
import EditorScreen from './src/screens/EditorScreen';
import EntryListScreen from './src/screens/EntryListScreen';
import LetterComposerScreen from './src/screens/LetterComposerScreen';
import LetterReaderScreen from './src/screens/LetterReaderScreen';
import LettersScreen from './src/screens/LettersScreen';
import LockScreen from './src/screens/LockScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { loadSettings, saveSettings, Settings } from './src/settings';
import { loadEntries, loadLetters, newId, saveEntries, saveLetters } from './src/storage';
import { makeStyles, ThemeProvider, useTheme } from './src/theme';
import { Entry, Letter } from './src/types';

type Tab = 'list' | 'calendar' | 'letters';

/** Full-screen views that sit on top of the tabs. */
type Overlay =
  | { kind: 'entry'; entry: Entry; isNew: boolean }
  | { kind: 'compose' }
  | { kind: 'letter'; letter: Letter }
  | { kind: 'settings' }
  | null;

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'list', icon: '📖', label: 'Diary' },
  { key: 'calendar', icon: '📅', label: 'Calendar' },
  { key: 'letters', icon: '✉️', label: 'Letters' },
];

interface Data {
  entries: Entry[];
  letters: Letter[];
}

/** Loads everything once, then renders the app inside the chosen theme. */
export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // If the diary can't be read, stop here: the app must not start empty and then save over it.
  const load = () => {
    setLoadFailed(false);
    Promise.all([loadEntries(), loadLetters(), loadSettings()]).then(
      ([entries, letters, s]) => {
        setSettings(s);
        setData({ entries, letters });
      },
      () => setLoadFailed(true),
    );
  };

  useEffect(load, []);

  const changeSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s).catch(warnSaveFailed);
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider pref={settings?.theme ?? 'system'}>
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
  Alert.alert(
    'Couldn’t save',
    'Your last change may be lost when the app closes. Try again, and save a backup from Settings.',
  );
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
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' }}>
        Couldn’t open your diary
      </Text>
      <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' }}>
        Nothing has been changed or deleted. Try again, or restart the app.
      </Text>
      <Pressable
        onPress={onRetry}
        style={{ marginTop: 24, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Try again</Text>
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

  const [entries, setEntries] = useState(initial.entries);
  const [letters, setLetters] = useState(initial.letters);
  const [locked, setLocked] = useState(settings.lock);
  const [tab, setTab] = useState<Tab>('list');
  const [today, setToday] = useState(todayKey());
  const [selectedDay, setSelectedDay] = useState(today);
  const [overlay, setOverlay] = useState<Overlay>(null);

  // When the app comes back: refresh "today" (it may be past midnight), and re-lock if it was away a while.
  const backgroundedAt = useRef<number | null>(null);
  const lockOn = useRef(settings.lock);
  lockOn.current = settings.lock;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        setToday(todayKey());
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

  // Newest day first; within a day, newest written first.
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [entries],
  );
  const memories = useMemo(() => memoriesFor(entries, today), [entries, today]);
  const readyLetters = letters.filter((l) => !l.openedAt && l.opensOn <= today).length;

  // ---- entries ----
  const commitEntries = (next: Entry[]) => {
    setEntries(next);
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
    const exists = entries.some((x) => x.id === e.id);
    commitEntries(exists ? entries.map((x) => (x.id === e.id ? e : x)) : [e, ...entries]);
    setSelectedDay(e.date);
    setOverlay(null);
  };

  const deleteEntry = (id: string) => {
    commitEntries(entries.filter((x) => x.id !== id));
    setOverlay(null);
  };

  // ---- letters ----
  const commitLetters = (next: Letter[]) => {
    setLetters(next);
    saveLetters(next).catch(warnSaveFailed);
  };

  const sealLetter = async (body: string, opensOn: string) => {
    const letter: Letter = { id: newId(), body, writtenOn: today, opensOn, createdAt: Date.now() };
    const next = [...letters, letter];
    commitLetters(next);
    setOverlay(null);
    setTab('letters');
    // Ask for notification permission after sealing, so the prompt makes sense in context.
    const notificationId = await scheduleLetterNotification(letter);
    if (notificationId) {
      commitLetters(next.map((l) => (l.id === letter.id ? { ...l, notificationId } : l)));
    }
  };

  const openLetter = (letter: Letter) => {
    if (letter.opensOn > today) return; // still sealed
    let shown = letter;
    if (!letter.openedAt) {
      shown = { ...letter, openedAt: Date.now() };
      commitLetters(letters.map((l) => (l.id === letter.id ? shown : l)));
    }
    setOverlay({ kind: 'letter', letter: shown });
  };

  const deleteLetter = (id: string) => {
    cancelNotification(letters.find((l) => l.id === id)?.notificationId);
    commitLetters(letters.filter((l) => l.id !== id));
  };

  // ---- backup ----
  const doExport = async () => {
    try {
      await exportBackup(entries, letters);
    } catch (e) {
      Alert.alert('Couldn’t save the backup', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const doImport = async () => {
    try {
      const result = await importBackup({ entries, letters });
      if (!result) return;
      commitEntries(result.entries);
      // Imported sealed letters get their own unlock notifications on this phone.
      const known = new Set(letters.map((l) => l.id));
      const withNotifications = await Promise.all(
        result.letters.map(async (l) =>
          known.has(l.id) || l.openedAt ? l : { ...l, notificationId: await scheduleLetterNotification(l) },
        ),
      );
      commitLetters(withNotifications);
      const summary =
        result.addedEntries + result.addedLetters === 0
          ? 'Everything in that backup is already in your diary.'
          : `Added ${result.addedEntries} ${result.addedEntries === 1 ? 'entry' : 'entries'} and ${result.addedLetters} ${result.addedLetters === 1 ? 'letter' : 'letters'}.`;
      const skippedNote =
        result.skipped > 0
          ? ` ${result.skipped} ${result.skipped === 1 ? 'item was' : 'items were'} damaged and left out.`
          : '';
      Alert.alert('Backup restored', summary + skippedNote);
    } catch (e) {
      Alert.alert('Couldn’t restore', e instanceof Error ? e.message : 'Please try again.');
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
            onClose={() => setOverlay(null)}
          />
        );
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
              <Text style={styles.appTitle}>{tab === 'letters' ? 'Letters' : 'My Diary'}</Text>
              <View style={styles.headerRight}>
                {tab !== 'letters' && (
                  <Text style={styles.count}>
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                  </Text>
                )}
                <Pressable
                  onPress={() => setOverlay({ kind: 'settings' })}
                  hitSlop={12}
                  accessibilityLabel="Settings"
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
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  onOpen={openEntry}
                />
              )}
              {tab === 'letters' && (
                <LettersScreen
                  letters={letters}
                  today={today}
                  onWrite={() => setOverlay({ kind: 'compose' })}
                  onOpen={openLetter}
                  onDelete={deleteLetter}
                />
              )}

              {tab !== 'letters' && (
                <Pressable
                  onPress={startNewEntry}
                  style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
                  accessibilityLabel="New entry"
                >
                  <Text style={styles.fabText}>＋</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.tabBar}>
              {TABS.map((t) => (
                <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                  <View>
                    <Text style={styles.tabIcon}>{t.icon}</Text>
                    {t.key === 'letters' && readyLetters > 0 && <View style={styles.badge} />}
                  </View>
                  <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
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
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
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
    appTitle: { fontSize: 30, fontWeight: '800', color: colors.ink },
    count: { fontSize: 14, color: colors.muted },
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
    tabLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
    tabActive: { color: colors.accent, fontWeight: '700' },
  }),
);
