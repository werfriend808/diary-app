import { ReactNode, useEffect, useEffectEvent, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { canLock, unlock } from '../lock';
import { Settings } from '../settings';
import { makeStyles, ThemePref, useTheme } from '../theme';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function SettingsScreen({
  settings,
  onChange,
  onExport,
  onImport,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [lockAvailable, setLockAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  useEffect(() => {
    canLock().then(setLockAvailable);
  }, []);

  // Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(onClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const toggleLock = async (on: boolean) => {
    if (on && !lockAvailable) {
      Alert.alert(
        'Set up a screen lock first',
        'To lock your diary, your phone needs a passcode, fingerprint or face unlock. You can set one up in your phone’s settings.',
      );
      return;
    }
    // Confirm it's really the owner before turning the lock on or off.
    if (await unlock(on ? 'Confirm to turn on the lock' : 'Confirm to turn off the lock')) {
      onChange({ ...settings, lock: on });
    }
  };

  const run = async (kind: 'export' | 'import', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.topBtn}>Done</Text>
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Group title="Appearance">
          <View style={styles.segment}>
            {THEMES.map((t) => {
              const active = settings.theme === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => onChange({ ...settings, theme: t.key })}
                  style={[styles.segBtn, active && styles.segActive]}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Group>

        <Group title="Privacy">
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Lock my diary</Text>
              <Text style={styles.rowSub}>
                Ask for Face ID, fingerprint or your passcode when the app opens.
              </Text>
            </View>
            <Switch
              value={settings.lock}
              onValueChange={toggleLock}
              disabled={lockAvailable === null}
              trackColor={{ true: colors.accent, false: colors.line }}
              thumbColor="#fff"
            />
          </View>
        </Group>

        <Group title="Backup">
          <Text style={styles.note}>
            Your diary lives only on this phone. Save a backup now and then, so you don’t lose it if you
            change or lose your phone.
          </Text>
          <ActionButton
            label="Save a backup"
            sub="Entries, photos and letters in one file. Save it to Files, Google Drive or email."
            busy={busy === 'export'}
            disabled={busy !== null}
            onPress={() => run('export', onExport)}
          />
          <ActionButton
            label="Restore from a backup"
            sub="Adds entries and letters from a backup file. Nothing you have now is deleted."
            busy={busy === 'import'}
            disabled={busy !== null}
            onPress={() => run('import', onImport)}
          />
          <Text style={styles.warn}>
            The backup file isn’t encrypted, and it includes your sealed letters. Keep it somewhere private.
          </Text>
        </Group>

        <Text style={styles.footer}>
          No account. No ads. Your words never leave this phone unless you save a backup.
        </Text>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton(p: {
  label: string;
  sub: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled}
      style={({ pressed }) => [styles.action, (pressed || p.disabled) && { opacity: 0.6 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{p.label}</Text>
        <Text style={styles.rowSub}>{p.sub}</Text>
      </View>
      {p.busy ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.chev}>›</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
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
    topBtn: { fontSize: 16, color: colors.accent, fontWeight: '600' },
    topTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
    content: { padding: 16, paddingBottom: 60 },
    groupTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segActive: { backgroundColor: colors.accent },
    segText: { fontSize: 15, color: colors.ink },
    segTextActive: { color: '#fff', fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    rowTitle: { fontSize: 16, color: colors.ink, fontWeight: '600' },
    rowSub: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
    note: { fontSize: 14, color: colors.ink, lineHeight: 20, marginBottom: 12 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    actionTitle: { fontSize: 16, color: colors.accent, fontWeight: '600' },
    chev: { fontSize: 24, color: colors.muted },
    warn: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2 },
    footer: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 8 },
  }),
);
