import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { longDate } from '../dates';
import { Memory } from '../memories';
import { colors, moodOf, paper, serif } from '../theme';
import { Entry } from '../types';

export default function MemoriesSection({
  memories,
  readyLetters,
  hasEntries,
  onOpen,
  onOpenLetters,
}: {
  memories: Memory[];
  readyLetters: number;
  hasEntries: boolean;
  onOpen: (e: Entry) => void;
  onOpenLetters: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = memories.length > 1 ? width - 64 : width - 32;

  return (
    <View style={styles.wrap}>
      {readyLetters > 0 && (
        <Pressable onPress={onOpenLetters} style={({ pressed }) => [styles.letterBanner, pressed && { opacity: 0.8 }]}>
          <Text style={styles.letterIcon}>✉️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.letterTitle}>
              {readyLetters === 1 ? 'A letter from your past self' : `${readyLetters} letters from your past self`}
            </Text>
            <Text style={styles.letterSub}>{readyLetters === 1 ? 'It’s ready to open.' : 'They’re ready to open.'}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      )}

      {memories.length > 0 ? (
        <>
          <Text style={styles.heading}>On this day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 10}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 10 }}
          >
            {memories.map(({ entry, label }) => (
              <MemoryCard key={entry.id} entry={entry} label={label} width={cardWidth} onPress={() => onOpen(entry)} />
            ))}
          </ScrollView>
        </>
      ) : (
        hasEntries && (
          <Text style={styles.hint}>
            Keep writing. In a week, today’s entry will come back to you here.
          </Text>
        )
      )}

      {hasEntries && <Text style={styles.allHeading}>All entries</Text>}
    </View>
  );
}

function MemoryCard({
  entry,
  label,
  width,
  onPress,
}: {
  entry: Entry;
  label: string;
  width: number;
  onPress: () => void;
}) {
  const mood = moodOf(entry.mood);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.85 }]}>
      {entry.photoUri && (
        <View>
          <Image source={{ uri: entry.photoUri }} style={styles.photo} />
          {/* A warm wash over the photo so it reads like an old print. */}
          <View style={styles.photoWash} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.date}>
          {longDate(entry.date)} {mood ? ` ${mood.emoji}` : ''}
        </Text>
        {entry.title.trim().length > 0 && <Text style={styles.title}>{entry.title.trim()}</Text>}
        {entry.body.trim().length > 0 && (
          <Text style={styles.body} numberOfLines={entry.photoUri ? 3 : 6}>
            {entry.body.trim()}
          </Text>
        )}
        <Text style={styles.readMore}>Read the whole entry</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  heading: { fontFamily: serif, fontSize: 20, color: paper.ink, marginBottom: 10, fontStyle: 'italic' },
  allHeading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 22, marginBottom: 10, letterSpacing: 0.5 },
  hint: { fontFamily: serif, fontStyle: 'italic', color: paper.faded, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: paper.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: paper.edge,
    overflow: 'hidden',
    shadowColor: '#5A4631',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  photo: { width: '100%', height: 150 },
  photoWash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(196,150,90,0.18)' },
  cardBody: { padding: 16 },
  label: { fontSize: 11, letterSpacing: 1.5, color: colors.accent, fontWeight: '700' },
  date: { fontFamily: serif, fontSize: 14, color: paper.faded, marginTop: 4 },
  title: { fontFamily: serif, fontSize: 19, color: paper.ink, marginTop: 10 },
  body: { fontFamily: serif, fontSize: 15, lineHeight: 23, color: paper.ink, marginTop: 6 },
  readMore: { marginTop: 12, fontSize: 13, color: colors.accent, fontWeight: '600' },
  letterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  letterIcon: { fontSize: 26 },
  letterTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  letterSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 24, color: colors.accent },
});
