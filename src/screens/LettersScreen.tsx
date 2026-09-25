import { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { daysBetween, humanSpan, mediumDate } from '../dates';
import { colors, paper, serif } from '../theme';
import { Letter } from '../types';

export default function LettersScreen({
  letters,
  today,
  onWrite,
  onOpen,
  onDelete,
}: {
  letters: Letter[];
  today: string;
  onWrite: () => void;
  onOpen: (l: Letter) => void;
  onDelete: (id: string) => void;
}) {
  const ready = letters.filter((l) => !l.openedAt && l.opensOn <= today).sort(byOpensOn);
  const sealed = letters.filter((l) => !l.openedAt && l.opensOn > today).sort(byOpensOn);
  const opened = letters.filter((l) => l.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));

  const confirmDelete = (l: Letter) =>
    Alert.alert(
      'Delete this letter?',
      l.openedAt ? 'This cannot be undone.' : 'It will be gone before you ever get to read it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(l.id) },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Write to the person you’ll be. The letter stays sealed until the day you choose.
      </Text>
      <Pressable onPress={onWrite} style={({ pressed }) => [styles.writeBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.writeText}>Write a letter to future you</Text>
      </Pressable>

      {ready.length > 0 && (
        <Section title="Ready to open">
          {ready.map((l) => (
            <Pressable key={l.id} onPress={() => onOpen(l)} style={({ pressed }) => [styles.envelope, styles.ready, pressed && { opacity: 0.85 }]}>
              <Text style={styles.envIcon}>✉️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.envTitle}>From {mediumDate(l.writtenOn)}</Text>
                <Text style={styles.envSub}>Written {humanSpan(l.writtenOn, today)} ago · tap to open</Text>
              </View>
            </Pressable>
          ))}
        </Section>
      )}

      {sealed.length > 0 && (
        <Section title="Sealed">
          {sealed.map((l) => {
            const days = daysBetween(today, l.opensOn);
            return (
              <Pressable key={l.id} onLongPress={() => confirmDelete(l)} style={styles.envelope}>
                <Text style={styles.envIcon}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.envTitle}>Opens {mediumDate(l.opensOn)}</Text>
                  <Text style={styles.envSub}>
                    {days === 1 ? 'Tomorrow' : `In ${humanSpan(today, l.opensOn)}`} · written {mediumDate(l.writtenOn)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Section>
      )}

      {opened.length > 0 && (
        <Section title="Opened">
          {opened.map((l) => (
            <Pressable key={l.id} onPress={() => onOpen(l)} onLongPress={() => confirmDelete(l)} style={styles.openedCard}>
              <Text style={styles.openedDate}>Written {mediumDate(l.writtenOn)}</Text>
              <Text style={styles.openedBody} numberOfLines={3}>
                {l.body.trim()}
              </Text>
            </Pressable>
          ))}
        </Section>
      )}

      {letters.length > 0 && <Text style={styles.tip}>Long-press a letter to delete it.</Text>}
    </ScrollView>
  );
}

const byOpensOn = (a: Letter, b: Letter) => (a.opensOn < b.opensOn ? -1 : 1);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  intro: { fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 24, color: paper.ink },
  writeBtn: { marginTop: 16, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  writeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, letterSpacing: 0.5, marginBottom: 10 },
  envelope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: paper.bg,
    borderWidth: 1,
    borderColor: paper.edge,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  ready: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  envIcon: { fontSize: 26 },
  envTitle: { fontFamily: serif, fontSize: 17, color: paper.ink },
  envSub: { fontSize: 13, color: paper.faded, marginTop: 3 },
  openedCard: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  openedDate: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  openedBody: { fontFamily: serif, fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: 6 },
  tip: { marginTop: 20, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
