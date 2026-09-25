import { Platform } from 'react-native';
import { MoodKey } from './types';

export const colors = {
  bg: '#FAF6F0',
  card: '#FFFFFF',
  ink: '#2B2622',
  muted: '#8A8178',
  line: '#E8E0D5',
  accent: '#C8643B',
  accentSoft: '#F6E4DA',
  danger: '#B3261E',
};

/** Book-like typeface for looking back: Georgia on iOS, the system serif on Android. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

export const paper = {
  bg: '#F3EADB',
  edge: '#E2D3BC',
  ink: '#4A3F35',
  faded: '#9C8B77',
};

export const MOODS: { key: MoodKey; emoji: string; label: string; color: string }[] = [
  { key: 'great', emoji: '😄', label: 'Great', color: '#E9A23B' },
  { key: 'good', emoji: '🙂', label: 'Good', color: '#7FB069' },
  { key: 'okay', emoji: '😐', label: 'Okay', color: '#A39A8F' },
  { key: 'low', emoji: '😔', label: 'Low', color: '#6C8EBF' },
  { key: 'sad', emoji: '😢', label: 'Sad', color: '#7A6BB0' },
];

export const moodOf = (key?: MoodKey) => MOODS.find((m) => m.key === key);
