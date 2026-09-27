import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { humanSpan, mediumDate, mediumDateTime, untilLabel } from '../dates';
import { isUnlocked, sealedPeriod, unlockTime } from '../letters';
import { makeStyles, TYPE, useTheme } from '../theme';
import { Letter } from '../types';

export default function LettersScreen({
  letters,
  today,
  now,
  notificationsOff,
  onWrite,
  onOpen,
  onDelete,
}: {
  letters: Letter[];
  today: string;
  /** The moment letters are checked against — App refreshes it when the next letter opens. */
  now: number;
  /** Notification permission was turned down, so opening letters can't send a notification. */
  notificationsOff: boolean;
  onWrite: () => void;
  onOpen: (l: Letter) => void;
  onDelete: (id: string) => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { korean } = useTheme();
  const ready = letters.filter((l) => !l.openedAt && isUnlocked(l, now)).sort(byUnlock);
  const sealed = letters.filter((l) => !l.openedAt && !isUnlocked(l, now)).sort(byUnlock);
  const opened = letters.filter((l) => l.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));

  const sealedTitle = (l: Letter) => {
    const period = sealedPeriod(l);
    return period
      ? t('letters.sealedTitle', { period: t(`composer.periods.${period}`) })
      : t('letters.sealedTitleCustom');
  };

  const confirmDelete = (l: Letter) =>
    Alert.alert(
      t('letters.deleteTitle'),
      l.openedAt ? t('letters.deleteOpened') : t('letters.deleteSealed'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(l.id) },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t('letters.intro')}</Text>
      <Pressable onPress={onWrite} style={({ pressed }) => [styles.writeBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.writeText}>{t('letters.write')}</Text>
      </Pressable>

      {ready.length > 0 && (
        <Section title={t('letters.ready')}>
          {ready.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => onOpen(l)}
              style={({ pressed }) => [styles.envelope, styles.ready, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.envIcon}>✉️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.envTitle}>{t('letters.from', { date: mediumDate(l.writtenOn) })}</Text>
                <Text style={styles.envSub}>{t('letters.readySub', { span: humanSpan(l.writtenOn, today) })}</Text>
              </View>
            </Pressable>
          ))}
        </Section>
      )}

      {sealed.length > 0 && (
        <Section title={t('letters.sealed')}>
          {notificationsOff && (
            <Text style={styles.notice}>{t('letters.notificationsOff')}</Text>
          )}
          {sealed.map((l) => {
            const at = unlockTime(l);
            return (
              <Pressable key={l.id} onLongPress={() => confirmDelete(l)} style={styles.envelope}>
                <Text style={styles.envIcon}>🔒</Text>
                <View style={{ flex: 1 }}>
                  {korean ? (
                    // A handwritten heading from its period ("1년 뒤의 나에게"), the opening time under it.
                    <>
                      <Text style={styles.sealedTitle}>{sealedTitle(l)}</Text>
                      <Text style={styles.sealedWhen}>{t('letters.opens', { when: mediumDateTime(at) })}</Text>
                    </>
                  ) : (
                    <Text style={styles.envTitle}>{t('letters.opens', { when: mediumDateTime(at) })}</Text>
                  )}
                  <Text style={styles.envSub}>
                    {t('letters.sealedSub', { until: untilLabel(now, at), date: mediumDate(l.writtenOn) })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Section>
      )}

      {opened.length > 0 && (
        <Section title={t('letters.opened')}>
          {opened.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => onOpen(l)}
              onLongPress={() => confirmDelete(l)}
              style={styles.openedCard}
            >
              <Text style={styles.openedDate}>{t('letters.writtenOn', { date: mediumDate(l.writtenOn) })}</Text>
              <Text style={styles.openedBody} numberOfLines={3}>
                {l.body.trim()}
              </Text>
            </Pressable>
          ))}
        </Section>
      )}

      {letters.length > 0 && <Text style={styles.tip}>{t('letters.tip')}</Text>}
    </ScrollView>
  );
}

const byUnlock = (a: Letter, b: Letter) => unlockTime(a) - unlockTime(b);

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ colors, paper, fonts, korean }) =>
  StyleSheet.create({
    container: { padding: 16, paddingBottom: 60 },
    intro: { ...fonts.body, ...fonts.italic, fontSize: 16, lineHeight: 24, color: paper.ink },
    writeBtn: {
      marginTop: 16,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    writeText: { ...fonts.uiBold, color: '#fff', fontSize: 16 },
    sectionTitle: {
      ...fonts.uiSemiBold,
      fontSize: 13,
      color: colors.muted,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
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
    // In Korean the card titles are dates, so they use the UI font.
    envTitle: { ...(korean ? { ...fonts.uiSemiBold, fontSize: 16 } : { ...fonts.body, fontSize: 17 }), color: paper.ink },
    sealedTitle: { ...fonts.accent, ...TYPE.accentTitle, color: paper.ink },
    sealedWhen: { ...fonts.uiMedium, fontSize: 14, color: paper.ink, marginTop: 2 },
    envSub: { ...fonts.ui, fontSize: 13, color: paper.faded, marginTop: 3 },
    openedCard: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    openedDate: { ...fonts.uiSemiBold, fontSize: 12, color: colors.muted },
    openedBody: {
      ...fonts.body,
      ...(korean ? TYPE.cardBody : { fontSize: 15, lineHeight: 22 }),
      color: colors.ink,
      marginTop: 6,
    },
    notice: { ...fonts.ui, fontSize: 13, lineHeight: 18, color: colors.muted, marginBottom: 10 },
    tip: { ...fonts.ui, marginTop: 20, fontSize: 12, color: colors.muted, textAlign: 'center' },
  }),
);
