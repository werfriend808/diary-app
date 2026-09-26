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
import { addMonths, longDate } from '../dates';
import { makeStyles, serif, useTheme } from '../theme';

const OPTIONS = [
  { months: 1, label: '1 month' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 36, label: '3 years' },
];

export default function LetterComposerScreen({
  today,
  onSeal,
  onClose,
}: {
  today: string;
  onSeal: (body: string, opensOn: string) => void;
  onClose: () => void;
}) {
  const { paper } = useTheme();
  const styles = useStyles();
  const [body, setBody] = useState('');
  const [months, setMonths] = useState(12);
  const opensOn = addMonths(today, months);

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

  const seal = () => {
    if (!body.trim()) {
      Alert.alert('Your letter is empty', 'Write a few words to your future self first.');
      return;
    }
    Alert.alert('Seal this letter?', `You won’t be able to read or change it until ${longDate(opensOn)}.`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Seal it', onPress: () => onSeal(body, opensOn) },
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
          {OPTIONS.map((o) => {
            const active = o.months === months;
            return (
              <Pressable
                key={o.months}
                onPress={() => setMonths(o.months)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.opensOn}>Opens on {longDate(opensOn)}</Text>

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
