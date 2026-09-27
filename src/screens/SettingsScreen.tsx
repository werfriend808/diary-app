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
import { useTranslation } from 'react-i18next';
import { LanguagePref, languageName, LANGUAGES } from '../i18n';
import { canLock, unlock } from '../lock';
import { Settings } from '../settings';
import { makeStyles, ThemePref, useTheme } from '../theme';

const THEMES = [
  { key: 'system', label: 'settings.themeSystem' },
  { key: 'light', label: 'settings.themeLight' },
  { key: 'dark', label: 'settings.themeDark' },
] as const satisfies readonly { key: ThemePref; label: string }[];

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
  const { t } = useTranslation();
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
      Alert.alert(t('settings.setupLockTitle'), t('settings.setupLockBody'));
      return;
    }
    // Confirm it's really the owner before turning the lock on or off.
    if (await unlock(on ? t('lock.confirmOn') : t('lock.confirmOff'))) {
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
          <Text style={styles.topBtn}>{t('common.done')}</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Group title={t('settings.appearance')}>
          <Segment
            options={THEMES.map((o) => ({ key: o.key, label: t(o.label) }))}
            selected={settings.theme}
            onSelect={(theme) => onChange({ ...settings, theme })}
          />
        </Group>

        <Group title={t('settings.language')}>
          {/* Language names are always shown in their own language, so anyone can find theirs. */}
          <Segment<LanguagePref>
            options={[
              { key: 'system', label: t('settings.languageSystem') },
              ...LANGUAGES.map((l) => ({ key: l, label: languageName(l) })),
            ]}
            selected={settings.language}
            onSelect={(language) => onChange({ ...settings, language })}
          />
        </Group>

        <Group title={t('settings.privacy')}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('settings.lockTitle')}</Text>
              <Text style={styles.rowSub}>{t('settings.lockSub')}</Text>
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

        <Group title={t('settings.backup')}>
          <Text style={styles.note}>{t('settings.backupNote')}</Text>
          <ActionButton
            label={t('settings.saveBackup')}
            sub={t('settings.saveBackupSub')}
            busy={busy === 'export'}
            disabled={busy !== null}
            onPress={() => run('export', onExport)}
          />
          <ActionButton
            label={t('settings.restore')}
            sub={t('settings.restoreSub')}
            busy={busy === 'import'}
            disabled={busy !== null}
            onPress={() => run('import', onImport)}
          />
          <Text style={styles.warn}>{t('settings.backupWarning')}</Text>
        </Group>

        <Text style={styles.footer}>{t('settings.footer')}</Text>
      </ScrollView>
    </View>
  );
}

/** A row of mutually exclusive buttons, like a segmented control. */
function Segment<K extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { key: K; label: string }[];
  selected: K;
  onSelect: (key: K) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = selected === o.key;
        return (
          <Pressable key={o.key} onPress={() => onSelect(o.key)} style={[styles.segBtn, active && styles.segActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
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
    segBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    segActive: { backgroundColor: colors.accent },
    segText: { fontSize: 15, color: colors.ink, textAlign: 'center' },
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
