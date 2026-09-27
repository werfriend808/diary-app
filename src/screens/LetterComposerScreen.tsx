import { useEffect, useEffectEvent, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { longDateTime } from '../dates';
import {
  customProblem,
  defaultCustom,
  earliestCustom,
  latestCustom,
  PERIODS,
  periodUnlock,
} from '../letters';
import { makeStyles, serif, useTheme } from '../theme';

const CUSTOM = 'custom';
/** "In 1 minute", for trying out notifications. __DEV__ is false in release builds, which drop it. */
const DEV_MINUTE = 'dev-1min';
const CHOICES = [
  ...PERIODS.map((p) => ({ key: p.key, label: p.label })),
  ...(__DEV__ ? [{ key: DEV_MINUTE, label: '1 minute (dev)' }] : []),
  { key: CUSTOM, label: 'Pick date & time' },
];

/** The day from `day` and the time of day from `time`, as a timestamp. */
const combine = (day: Date, time: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes()).getTime();

export default function LetterComposerScreen({
  today,
  onSeal,
  onClose,
}: {
  today: string;
  /** opensAt: the exact moment the letter opens. */
  onSeal: (body: string, opensAt: number) => void;
  onClose: () => void;
}) {
  const { colors, paper, isDark } = useTheme();
  const styles = useStyles();
  const [body, setBody] = useState('');
  const [choice, setChoice] = useState('1y');
  const [customAt, setCustomAt] = useState<number | null>(null);
  // When the custom picker was opened; its earliest/latest limits are counted from here.
  const [pickerOpenedAt, setPickerOpenedAt] = useState(0);

  const period = PERIODS.find((p) => p.key === choice);
  // null for the dev option, which is counted from the moment of sealing.
  const opensAt = period ? periodUnlock(today, period) : choice === CUSTOM ? customAt : null;

  const requestClose = () => {
    if (!body.trim()) return onClose();
    Alert.alert('Discard this letter?', undefined, [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  // Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(requestClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const pickCustom = () => {
    const now = Date.now();
    setPickerOpenedAt(now);
    const earliest = earliestCustom(now);
    const latest = latestCustom(now);
    const start = Math.min(Math.max(customAt ?? defaultCustom(today), earliest), latest);

    if (Platform.OS !== 'android') {
      // iOS shows a date-and-time picker right on the screen (below the choices).
      setCustomAt(start);
      setChoice(CUSTOM);
      return;
    }
    // Android's pickers are dialogs, one for the date and then one for the time.
    // Dismissing either leaves the previous choice as it was.
    const pickTime = (day: Date) =>
      DateTimePickerAndroid.open({
        value: new Date(combine(day, new Date(start))),
        mode: 'time',
        onValueChange: (_event, time) => {
          const picked = combine(day, time);
          const problem = customProblem(picked, Date.now());
          if (problem) {
            Alert.alert('Pick another time', problem);
            return;
          }
          setCustomAt(picked);
          setChoice(CUSTOM);
        },
      });
    DateTimePickerAndroid.open({
      value: new Date(start),
      mode: 'date',
      minimumDate: new Date(earliest),
      maximumDate: new Date(latest),
      onValueChange: (_event, day) => pickTime(day),
    });
  };

  /** The moment to seal with right now, or null (after telling the user) if the choice isn't usable. */
  const sealTime = (): number | null => {
    const now = Date.now();
    if (choice === DEV_MINUTE) return now + 60_000;
    if (opensAt === null) return null;
    const problem = choice === CUSTOM ? customProblem(opensAt, now) : null;
    if (problem) {
      Alert.alert('Pick another time', problem);
      return null;
    }
    return opensAt;
  };

  const seal = () => {
    if (!body.trim()) {
      Alert.alert('Your letter is empty', 'Write a few words to your future self first.');
      return;
    }
    const at = sealTime();
    if (at === null) return;
    const until = choice === DEV_MINUTE ? 'a minute from now' : longDateTime(at);
    Alert.alert('Seal this letter?', `You won’t be able to read or change it until ${until}.`, [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Seal it',
        // Checked again: the confirmation may have been left open for a while.
        onPress: () => {
          const final = sealTime();
          if (final !== null) onSeal(body, final);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={requestClose} hitSlop={10}>
          <Text style={styles.topBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>Letter to future you</Text>
        <Pressable onPress={seal} hitSlop={10}>
          <Text style={[styles.topBtn, { fontWeight: '700' }]}>Seal</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Open it in</Text>
        <View style={styles.chips}>
          {CHOICES.map((o) => {
            const active = o.key === choice;
            return (
              <Pressable
                key={o.key}
                onPress={() => (o.key === CUSTOM ? pickCustom() : setChoice(o.key))}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {choice === CUSTOM && customAt !== null && Platform.OS === 'ios' && (
          <View style={styles.pickerRow}>
            <DateTimePicker
              value={new Date(customAt)}
              mode="datetime"
              display="compact"
              minimumDate={new Date(earliestCustom(pickerOpenedAt))}
              maximumDate={new Date(latestCustom(pickerOpenedAt))}
              onValueChange={(_event, d) => setCustomAt(d.getTime())}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={colors.accent}
            />
          </View>
        )}

        <Text style={styles.opensOn}>
          {opensAt !== null
            ? `Opens ${longDateTime(opensAt)}`
            : __DEV__ && 'Opens 1 minute after you seal it (development builds only)'}
        </Text>

        <View style={styles.paper}>
          <Text style={styles.salutation}>Dear future me,</Text>
          <TextInput
            style={styles.body}
            placeholder="What’s on your mind today? What do you hope has changed, or stayed the same?"
            placeholderTextColor={paper.faded}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    label: { fontSize: 13, color: colors.muted, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: 14, color: colors.ink },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    opensOn: { marginTop: 10, fontSize: 13, color: colors.muted },
    pickerRow: { marginTop: 12, flexDirection: 'row' },
    paper: {
      marginTop: 20,
      backgroundColor: paper.bg,
      borderWidth: 1,
      borderColor: paper.edge,
      borderRadius: 6,
      padding: 18,
      minHeight: 320,
    },
    salutation: { fontFamily: serif, fontStyle: 'italic', fontSize: 18, color: paper.ink, marginBottom: 10 },
    body: { fontFamily: serif, fontSize: 16, lineHeight: 25, color: paper.ink, minHeight: 240 },
  }),
);
