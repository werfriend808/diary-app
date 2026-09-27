import * as ImagePicker from 'expo-image-picker';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { longDate, shiftDay, todayKey } from '../dates';
import { deletePhoto, persistPhoto, photoUrl } from '../storage';
import { MOODS, makeStyles, useTheme } from '../theme';
import { Entry, MoodKey } from '../types';

export default function EditorScreen({
  original,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  original: Entry;
  isNew: boolean;
  onSave: (e: Entry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [date, setDate] = useState(original.date);
  const [title, setTitle] = useState(original.title);
  const [body, setBody] = useState(original.body);
  const [mood, setMood] = useState<MoodKey | undefined>(original.mood);
  const [photoName, setPhotoName] = useState(original.photoName);
  const [busy, setBusy] = useState(false);

  // File names of photos copied during this edit that haven't been saved yet — cleaned up on cancel.
  const unsavedPhotos = useRef<string[]>([]);

  const dirty =
    date !== original.date ||
    title !== original.title ||
    body !== original.body ||
    mood !== original.mood ||
    photoName !== original.photoName;

  const discard = () => {
    unsavedPhotos.current.forEach(deletePhoto);
    onClose();
  };

  const requestClose = () => {
    if (!dirty) return discard();
    Alert.alert('Discard changes?', 'Your edits to this entry will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discard },
    ]);
  };

  // Android hardware back button behaves like "Back". Registered once, so the lock screen's handler stays on top.
  const onBack = useEffectEvent(requestClose);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setBusy(true);
    try {
      const saved = await persistPhoto(result.assets[0].uri);
      unsavedPhotos.current.push(saved);
      setPhotoName(saved);
    } catch {
      Alert.alert('Could not add photo', 'Please try a different image.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!title.trim() && !body.trim() && !photoName) {
      Alert.alert('Nothing to save', 'Write something or add a photo first.');
      return;
    }
    // Remove the old photo if it was replaced/removed, plus any extra picks that weren't kept.
    if (original.photoName && original.photoName !== photoName) deletePhoto(original.photoName);
    unsavedPhotos.current.filter((n) => n !== photoName).forEach(deletePhoto);

    onSave({ ...original, date, title, body, mood, photoName, updatedAt: Date.now() });
  };

  const confirmDelete = () =>
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // The saved photo is deleted along with the entry (App's deleteEntry); these are unsaved picks.
          unsavedPhotos.current.forEach(deletePhoto);
          onDelete(original.id);
        },
      },
    ]);

  const canGoForward = date < todayKey();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={requestClose} hitSlop={10}>
          <Text style={styles.topBtn}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>{isNew ? 'New entry' : 'Edit entry'}</Text>
        <Pressable onPress={save} hitSlop={10} disabled={busy}>
          <Text style={[styles.topBtn, styles.saveBtn, busy && { opacity: 0.4 }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.dateRow}>
          <Pressable onPress={() => setDate(shiftDay(date, -1))} hitSlop={12}>
            <Text style={styles.dateArrow}>‹</Text>
          </Pressable>
          <Text style={styles.dateText}>{longDate(date)}</Text>
          <Pressable
            onPress={() => canGoForward && setDate(shiftDay(date, 1))}
            hitSlop={12}
            disabled={!canGoForward}
          >
            <Text style={[styles.dateArrow, !canGoForward && { opacity: 0.25 }]}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>How are you feeling?</Text>
        <View style={styles.moodRow}>
          {MOODS.map((m) => {
            const active = mood === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMood(active ? undefined : m.key)}
                style={[styles.moodBtn, active && { backgroundColor: m.color + '33', borderColor: m.color }]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, active && { color: colors.ink, fontWeight: '600' }]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.title}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <TextInput
          style={styles.body}
          placeholder="What happened today?"
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />

        {photoName ? (
          <View>
            <Image source={{ uri: photoUrl(photoName) }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoActions}>
              <Pressable onPress={pickPhoto}>
                <Text style={styles.link}>Change photo</Text>
              </Pressable>
              <Pressable onPress={() => setPhotoName(undefined)}>
                <Text style={[styles.link, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addPhoto} onPress={pickPhoto} disabled={busy}>
            <Text style={styles.addPhotoText}>{busy ? 'Adding…' : '＋  Add a photo'}</Text>
          </Pressable>
        )}

        {!isNew && (
          <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete entry</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    topBtn: { fontSize: 16, color: colors.accent },
    saveBtn: { fontWeight: '700' },
    topTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
    content: { padding: 16, paddingBottom: 60 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    dateArrow: { fontSize: 28, color: colors.accent, paddingHorizontal: 10 },
    dateText: { fontSize: 15, fontWeight: '600', color: colors.ink },
    label: { fontSize: 13, color: colors.muted, marginBottom: 8 },
    moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    moodBtn: {
      flex: 1,
      marginHorizontal: 3,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    moodEmoji: { fontSize: 26 },
    moodLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.ink,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      marginBottom: 12,
    },
    body: { fontSize: 16, lineHeight: 24, color: colors.ink, minHeight: 180 },
    addPhoto: {
      marginTop: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.line,
      borderRadius: 14,
      paddingVertical: 22,
      alignItems: 'center',
    },
    addPhotoText: { color: colors.muted, fontSize: 15 },
    photo: { marginTop: 16, width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
    photoActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    deleteBtn: { marginTop: 36, alignItems: 'center', padding: 12 },
    deleteText: { color: colors.danger, fontSize: 15 },
  }),
);
