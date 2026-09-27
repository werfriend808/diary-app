import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fromKey, monthShort, shortWeekday } from '../dates';
import { photoUrl } from '../storage';
import { makeStyles, moodOf, TYPE } from '../theme';
import { Entry } from '../types';

export default function EntryCard({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const mood = moodOf(entry.mood);
  const d = fromKey(entry.date);
  const preview = entry.body.trim().replace(/\s+/g, ' ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View style={styles.dateCol}>
        <Text style={styles.day}>{d.getDate()}</Text>
        <Text style={styles.weekday}>{shortWeekday(entry.date)}</Text>
        <Text style={styles.month}>{monthShort(d.getMonth())}</Text>
      </View>

      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          {mood && <Text style={styles.mood}>{mood.emoji}</Text>}
          <Text style={styles.title} numberOfLines={1}>
            {entry.title.trim() || t('entries.untitled')}
          </Text>
        </View>
        {preview.length > 0 && (
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        )}
      </View>

      {entry.photoName && <Image source={{ uri: photoUrl(entry.photoName) }} style={styles.thumb} />}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, fonts, korean }) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 14,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    dateCol: { width: 40, alignItems: 'center' },
    day: { ...fonts.uiBold, fontSize: 22, color: colors.ink },
    weekday: { ...fonts.uiSemiBold, fontSize: 11, color: colors.accent, textTransform: 'uppercase' },
    month: { ...fonts.ui, fontSize: 11, color: colors.muted },
    textCol: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mood: { fontSize: 16 },
    // The entry's own words: 고운바탕 in Korean (list-sized; the full sizes are in the editor).
    title: { flex: 1, ...(korean ? fonts.bodyBold : fonts.uiSemiBold), fontSize: 16, color: colors.ink },
    preview: {
      marginTop: 4,
      ...(korean ? { ...fonts.body, ...TYPE.cardBody } : { fontSize: 14, lineHeight: 19 }),
      color: colors.muted,
    },
    thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: colors.line },
  }),
);
