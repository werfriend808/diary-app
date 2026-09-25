import { createContext, ReactNode, useContext, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { MoodKey } from './types';

export type ThemePref = 'system' | 'light' | 'dark';

const light = {
  colors: {
    bg: '#FAF6F0',
    card: '#FFFFFF',
    ink: '#2B2622',
    muted: '#8A8178',
    line: '#E8E0D5',
    accent: '#C8643B',
    accentSoft: '#F6E4DA',
    danger: '#B3261E',
  },
  /** Old-paper look used when looking back (memories, letters). */
  paper: {
    bg: '#F3EADB',
    edge: '#E2D3BC',
    ink: '#4A3F35',
    faded: '#9C8B77',
  },
};

type Palette = typeof light;

const dark: Palette = {
  colors: {
    bg: '#16130F',
    card: '#221E19',
    ink: '#EEE7DD',
    muted: '#9B9187',
    line: '#342E27',
    accent: '#E27D52',
    accentSoft: '#3A2A21',
    danger: '#F0776B',
  },
  paper: {
    bg: '#2B251E',
    edge: '#3E362C',
    ink: '#E9DDC9',
    faded: '#A89A85',
  },
};

export type Theme = Palette & { isDark: boolean };

const ThemeContext = createContext<Theme>({ ...light, isDark: false });

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo(() => ({ ...(isDark ? dark : light), isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Like StyleSheet.create, but the styles can use the current theme's colors.
 *   const useStyles = makeStyles(({ colors }) => ({ box: { backgroundColor: colors.card } }));
 *   const styles = useStyles();   // inside the component
 */
export function makeStyles<T>(factory: (t: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return () => {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = factory(theme);
      cache.set(theme, styles);
    }
    return styles;
  };
}

/** Book-like typeface for looking back: Georgia on iOS, the system serif on Android. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

export const MOODS: { key: MoodKey; emoji: string; label: string; color: string }[] = [
  { key: 'great', emoji: '😄', label: 'Great', color: '#E9A23B' },
  { key: 'good', emoji: '🙂', label: 'Good', color: '#7FB069' },
  { key: 'okay', emoji: '😐', label: 'Okay', color: '#A39A8F' },
  { key: 'low', emoji: '😔', label: 'Low', color: '#6C8EBF' },
  { key: 'sad', emoji: '😢', label: 'Sad', color: '#7A6BB0' },
];

export const moodOf = (key?: MoodKey) => MOODS.find((m) => m.key === key);
