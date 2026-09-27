import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { unlock } from '../lock';
import { makeStyles, serif } from '../theme';

/** Covers the whole app until the user unlocks with Face ID / fingerprint / passcode. */
export default function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const busy = useRef(false);

  const tryUnlock = async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await unlock();
    busy.current = false;
    if (ok) onUnlocked();
  };

  // Ask right away when the lock screen appears.
  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The app's screens stay mounted underneath, so keep Android's back button from reaching them.
  // Registered last, this handler runs first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>{t('lock.title')}</Text>
      <Text style={styles.sub}>{t('lock.sub')}</Text>
      <Pressable onPress={tryUnlock} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.btnText}>{t('lock.unlock')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, paper }) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: colors.bg,
    },
    icon: { fontSize: 48, marginBottom: 16 },
    title: { fontFamily: serif, fontSize: 24, color: paper.ink },
    sub: { marginTop: 6, fontSize: 15, color: colors.muted },
    btn: {
      marginTop: 28,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 48,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  }),
);
