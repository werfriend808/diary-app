import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONT_LICENSES } from '../licenses';
import { makeStyles, TYPE } from '../theme';

/** Settings → Open-source licenses: the bundled fonts and their SIL Open Font License texts. */
export default function LicensesScreen({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);

  // Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(onClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.topBtn}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t('licenses.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('licenses.intro')}</Text>
        {FONT_LICENSES.map((f) => {
          const expanded = open === f.key;
          return (
            <View key={f.key} style={styles.card}>
              <Text style={styles.name}>{t(`licenses.${f.key}`)}</Text>
              <Text style={styles.meta}>{t('licenses.license')}</Text>
              <Text style={styles.meta}>{f.source}</Text>
              <Text style={styles.copyright}>{f.text.split('\n')[0]}</Text>
              <Pressable onPress={() => setOpen(expanded ? null : f.key)} hitSlop={8}>
                <Text style={styles.toggle}>{expanded ? t('licenses.hideText') : t('licenses.showText')}</Text>
              </Pressable>
              {expanded && (
                <Text style={styles.licenseText} selectable>
                  {f.text}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, fonts, korean }) =>
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
    topBtn: { ...fonts.uiSemiBold, fontSize: 16, color: colors.accent },
    topTitle: { ...fonts.uiSemiBold, ...(korean ? TYPE.screenTitle : { fontSize: 16 }), color: colors.ink },
    content: { padding: 16, paddingBottom: 60 },
    intro: { ...fonts.ui, fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    name: { ...fonts.uiSemiBold, fontSize: 16, color: colors.ink, marginBottom: 4 },
    meta: { ...fonts.ui, fontSize: 13, color: colors.muted, marginTop: 2 },
    copyright: { ...fonts.ui, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 8 },
    toggle: { ...fonts.uiSemiBold, fontSize: 14, color: colors.accent, marginTop: 10 },
    // The license is legal text in English; kept plain and readable, not in the diary's body font.
    licenseText: { ...fonts.ui, fontSize: 12, lineHeight: 18, color: colors.ink, marginTop: 10 },
  }),
);
