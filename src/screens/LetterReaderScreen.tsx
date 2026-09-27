import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { humanSpan, longDate, toKey } from '../dates';
import { makeStyles, TYPE } from '../theme';
import { Letter } from '../types';

export default function LetterReaderScreen({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation();
  // Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(onClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // openLetter always stamps openedAt before showing a letter; opensOn is only a fallback.
  const openedOn = letter.openedAt ? toKey(new Date(letter.openedAt)) : letter.opensOn;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.topBtn}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t('reader.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>{t('reader.writtenAgo', { span: humanSpan(letter.writtenOn, openedOn) })}</Text>
        <View style={styles.paper}>
          <Text style={styles.date}>{longDate(letter.writtenOn)}</Text>
          <Text style={styles.salutation}>{t('common.dearFutureMe')}</Text>
          <Text style={styles.body}>{letter.body.trim()}</Text>
        </View>
        <Text style={styles.footer}>{t('reader.openedOn', { date: longDate(openedOn) })}</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, paper, fonts, korean }) =>
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
    topBtn: { ...fonts.ui, fontSize: 16, color: colors.accent },
    topTitle: { ...fonts.uiSemiBold, ...(korean ? TYPE.screenTitle : { fontSize: 16 }), color: colors.ink },
    content: { padding: 16, paddingBottom: 60 },
    meta: {
      ...fonts.uiBold,
      fontSize: 12,
      letterSpacing: 1.5,
      color: colors.accent,
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
    date: { ...(korean ? fonts.ui : fonts.body), fontSize: 14, color: paper.faded, textAlign: 'right', marginBottom: 16 },
    salutation: { ...fonts.body, ...fonts.italic, fontSize: 19, color: paper.ink, marginBottom: 12 },
    body: { ...fonts.body, ...(korean ? TYPE.entryBody : { fontSize: 17, lineHeight: 27 }), color: paper.ink },
    footer: { ...fonts.ui, marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center' },
  }),
);
