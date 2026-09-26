import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import EntryCard from '../components/EntryCard';
import { longDate, MONTHS, toKey } from '../dates';
import { makeStyles, moodOf, useTheme } from '../theme';
import { Entry } from '../types';

const WEEK_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen({
  entries,
  today,
  onOpen,
  selected,
  onSelect,
}: {
  entries: Entry[];
  today: string;
  onOpen: (e: Entry) => void;
  selected: string;
  onSelect: (dateKey: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [month, setMonth] = useState(() => {
    const [y, m] = selected.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [entries]);

  // Build a 6x7 grid (null = blank cell before the 1st / after the last day).
  const cells = useMemo(() => {
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(toKey(new Date(month.getFullYear(), month.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const dayEntries = byDay.get(selected) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.calendar}>
        <View style={styles.header}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={12}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          {WEEK_HEADER.map((w, i) => (
            <Text key={i} style={styles.weekLabel}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((key, i) => {
            if (!key) return <View key={i} style={styles.cell} />;
            const list = byDay.get(key);
            const mood = moodOf(list?.find((e) => e.mood)?.mood);
            const isSel = key === selected;
            const isToday = key === today;
            return (
              <Pressable key={i} style={styles.cell} onPress={() => onSelect(key)}>
                <View style={[styles.dayCircle, isSel && styles.daySelected]}>
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && !isSel && { color: colors.accent, fontWeight: '700' },
                      isSel && { color: '#fff', fontWeight: '700' },
                    ]}
                  >
                    {Number(key.slice(8))}
                  </Text>
                </View>
                {list && <View style={[styles.dot, { backgroundColor: mood?.color ?? colors.accent }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.dayTitle}>{longDate(selected)}</Text>
      {dayEntries.length === 0 ? (
        <Text style={styles.none}>No entries this day. Tap + to write one.</Text>
      ) : (
        dayEntries.map((e) => <EntryCard key={e.id} entry={e} onPress={() => onOpen(e)} />)
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    container: { padding: 16, paddingBottom: 110 },
    calendar: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    arrow: { fontSize: 30, color: colors.accent, paddingHorizontal: 8 },
    monthTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
    row: { flexDirection: 'row' },
    weekLabel: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      color: colors.muted,
      fontSize: 12,
      marginBottom: 4,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
    dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    daySelected: { backgroundColor: colors.accent },
    dayNum: { fontSize: 15, color: colors.ink },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
    dayTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 20, marginBottom: 10 },
    none: { color: colors.muted, fontSize: 14 },
  }),
);
