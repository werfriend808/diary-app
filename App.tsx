import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MemoriesSection from './src/components/MemoriesSection';
import { todayKey } from './src/dates';
import { memoriesFor } from './src/memories';
import CalendarScreen from './src/screens/CalendarScreen';
import EditorScreen from './src/screens/EditorScreen';
import EntryListScreen from './src/screens/EntryListScreen';
import LetterComposerScreen from './src/screens/LetterComposerScreen';
import LetterReaderScreen from './src/screens/LetterReaderScreen';
import LettersScreen from './src/screens/LettersScreen';
import { loadEntries, loadLetters, newId, saveEntries, saveLetters } from './src/storage';
import { colors } from './src/theme';
import { Entry, Letter } from './src/types';

type Tab = 'list' | 'calendar' | 'letters';

/** Full-screen views that sit on top of the tabs. */
type Overlay =
  | { kind: 'entry'; entry: Entry; isNew: boolean }
  | { kind: 'compose' }
  | { kind: 'letter'; letter: Letter }
  | null;

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'list', icon: '📖', label: 'Diary' },
  { key: 'calendar', icon: '📅', label: 'Calendar' },
  { key: 'letters', icon: '✉️', label: 'Letters' },
];

export default function App() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tab, setTab] = useState<Tab>('list');
  const [today, setToday] = useState(todayKey());
  const [selectedDay, setSelectedDay] = useState(today);
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => {
    Promise.all([loadEntries(), loadLetters()]).then(([e, l]) => {
      setLetters(l);
      setEntries(e);
    });
  }, []);

  // If the app was left open past midnight, refresh "today" when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setToday(todayKey()));
    return () => sub.remove();
  }, []);

  // Newest day first; within a day, newest written first.
  const sorted = useMemo(
    () =>
      [...(entries ?? [])].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      ),
    [entries],
  );
  const memories = useMemo(() => memoriesFor(entries ?? [], today), [entries, today]);
  const readyLetters = letters.filter((l) => !l.openedAt && l.opensOn <= today).length;

  // ---- entries ----
  const commitEntries = (next: Entry[]) => {
    setEntries(next);
    saveEntries(next);
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
    const list = entries ?? [];
    const exists = list.some((x) => x.id === e.id);
    commitEntries(exists ? list.map((x) => (x.id === e.id ? e : x)) : [e, ...list]);
    setSelectedDay(e.date);
    setOverlay(null);
  };

  const deleteEntry = (id: string) => {
    commitEntries((entries ?? []).filter((x) => x.id !== id));
    setOverlay(null);
  };

  // ---- letters ----
  const commitLetters = (next: Letter[]) => {
    setLetters(next);
    saveLetters(next);
  };

  const sealLetter = (body: string, opensOn: string) => {
    commitLetters([
      ...letters,
      { id: newId(), body, writtenOn: today, opensOn, createdAt: Date.now() },
    ]);
    setOverlay(null);
    setTab('letters');
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

  const deleteLetter = (id: string) => commitLetters(letters.filter((l) => l.id !== id));

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
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />

        {entries === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : overlay ? (
          renderOverlay()
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.appTitle}>{tab === 'letters' ? 'Letters' : 'My Diary'}</Text>
              {tab !== 'letters' && (
                <Text style={styles.count}>
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </Text>
              )}
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  appTitle: { fontSize: 30, fontWeight: '800', color: colors.ink },
  count: { fontSize: 14, color: colors.muted },
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
});
