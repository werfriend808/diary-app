import { useEffect, useEffectEvent } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { humanSpan, longDate, toKey } from '../dates';
import { makeStyles, serif } from '../theme';
import { Letter } from '../types';

export default function LetterReaderScreen({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const styles = useStyles();
  // Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(onClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const openedOn = toKey(new Date(letter.openedAt ?? Date.now()));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.topBtn}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>A letter from you</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>Written {humanSpan(letter.writtenOn, openedOn)} ago</Text>
        <View style={styles.paper}>
          <Text style={styles.date}>{longDate(letter.writtenOn)}</Text>
          <Text style={styles.salutation}>Dear future me,</Text>
          <Text style={styles.body}>{letter.body.trim()}</Text>
        </View>
        <Text style={styles.footer}>Opened {longDate(openedOn)}</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, paper }) =>
  StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    topBtn: { fontSize: 16, color: colors.accent },
    topTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
    content: { padding: 16, paddingBottom: 60 },
    meta: {
      fontSize: 12,
      letterSpacing: 1.5,
      color: colors.accent,
      fontWeight: '700',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginVertical: 8,
    },
    paper: {
      marginTop: 8,
      backgroundColor: paper.bg,
      borderWidth: 1,
      borderColor: paper.edge,
      borderRadius: 6,
      padding: 22,
    },
    date: { fontFamily: serif, fontSize: 14, color: paper.faded, textAlign: 'right', marginBottom: 16 },
    salutation: { fontFamily: serif, fontStyle: 'italic', fontSize: 19, color: paper.ink, marginBottom: 12 },
    body: { fontFamily: serif, fontSize: 17, lineHeight: 27, color: paper.ink },
    footer: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center' },
  }),
);
