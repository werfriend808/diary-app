import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, TextStyle, useColorScheme } from 'react-native';
import { FAMILY } from './fonts';
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

// ---- typography ----
//
// Screens never name a font: they spread a token into a style, e.g. { ...fonts.uiSemiBold, fontSize: 15 }.
// A token carries the family (and, for system fonts only, the weight), so the same style works for:
//  - Korean: 고운바탕 / Pretendard / 나눔손글씨 펜, one family per weight and never a fontWeight.
//  - English: exactly the look the app had before the Korean fonts (system font + weights, Georgia).
//  - Korean when the fonts failed to load: the system fonts, so nothing ever renders blank.

type FontToken = Pick<TextStyle, 'fontFamily' | 'fontWeight' | 'fontStyle'>;

export interface Fonts {
  /** What people write (entries, letters, memory cards). */
  body: FontToken;
  bodyBold: FontToken;
  /** Everything else: dates, buttons, tabs, settings, numbers, placeholders. */
  ui: FontToken;
  uiMedium: FontToken;
  uiSemiBold: FontToken;
  /** Bold / extra-bold UI text. Pretendard ships only up to SemiBold, so in Korean these are SemiBold. */
  uiBold: FontToken;
  uiHeavy: FontToken;
  /** Handwriting — only short accents ("1년 전", sealed letter titles). */
  accent: FontToken;
  /** Add to a style for a slanted look. Empty in Korean: Hangul has no italics and a faked slant looks broken. */
  italic: FontToken;
}

/** Book-like typeface for looking back: Georgia on iOS, the system serif on Android. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const SYSTEM_FONTS: Fonts = {
  body: { fontFamily: serif },
  bodyBold: { fontFamily: serif, fontWeight: '700' },
  ui: {},
  uiMedium: { fontWeight: '500' },
  uiSemiBold: { fontWeight: '600' },
  uiBold: { fontWeight: '700' },
  uiHeavy: { fontWeight: '800' },
  accent: {},
  italic: { fontStyle: 'italic' },
};

const KOREAN_FONTS: Fonts = {
  body: { fontFamily: FAMILY.body },
  bodyBold: { fontFamily: FAMILY.bodyBold },
  ui: { fontFamily: FAMILY.ui },
  uiMedium: { fontFamily: FAMILY.uiMedium },
  uiSemiBold: { fontFamily: FAMILY.uiSemiBold },
  uiBold: { fontFamily: FAMILY.uiSemiBold },
  uiHeavy: { fontFamily: FAMILY.uiSemiBold },
  accent: { fontFamily: FAMILY.accent },
  italic: {},
};

/** line height as a number: size × ratio, rounded to 0.1 */
const lh = (size: number, ratio: number) => Math.round(size * ratio * 10) / 10;

/** Korean sizes and line spacing. Screens use these only when theme.korean is true. */
export const TYPE = {
  /** 일기 제목 — with fonts.bodyBold */
  entryTitle: { fontSize: 20, lineHeight: lh(20, 1.4) },
  /** 일기·편지 본문, when writing and when reading — with fonts.body */
  entryBody: { fontSize: 16, lineHeight: lh(16, 1.8) },
  /** 카드 본문 (memory cards, list previews) — with fonts.body */
  cardBody: { fontSize: 14, lineHeight: lh(14, 1.7) },
  /** UI 기본 — with fonts.ui */
  ui: { fontSize: 14 },
  /** 화면 제목 — with fonts.uiSemiBold */
  screenTitle: { fontSize: 17 },
  /** 손글씨 라벨 (≈1.5× the text around it) — with fonts.accent */
  accentLabel: { fontSize: 22, lineHeight: lh(22, 1.2) },
  /** 손글씨 편지 제목 — with fonts.accent */
  accentTitle: { fontSize: 28, lineHeight: lh(28, 1.2) },
} as const;

export type Theme = Palette & {
  isDark: boolean;
  /** Korean typography is on (the app language is Korean). English keeps the app's original type. */
  korean: boolean;
  fonts: Fonts;
};

const ThemeContext = createContext<Theme>({ ...light, isDark: false, korean: false, fonts: SYSTEM_FONTS });

export function ThemeProvider({
  pref,
  fontsReady,
  children,
}: {
  pref: ThemePref;
  /** The Korean font files loaded. If they didn't, Korean text uses the system fonts. */
  fontsReady: boolean;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const { i18n } = useTranslation();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const korean = i18n.language === 'ko';
  const value = useMemo(() => {
    const fonts = korean && fontsReady ? KOREAN_FONTS : korean ? { ...SYSTEM_FONTS, italic: {} } : SYSTEM_FONTS;
    return { ...(isDark ? dark : light), isDark, korean, fonts };
  }, [isDark, korean, fontsReady]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Like StyleSheet.create, but the styles can use the current theme's colors and fonts.
 *   const useStyles = makeStyles(({ colors, fonts }) => ({ box: { backgroundColor: colors.card, ...fonts.ui } }));
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

/** Mood names are in the language files under moods.<key>. */
export const MOODS: { key: MoodKey; emoji: string; color: string }[] = [
  { key: 'great', emoji: '😄', color: '#E9A23B' },
  { key: 'good', emoji: '🙂', color: '#7FB069' },
  { key: 'okay', emoji: '😐', color: '#A39A8F' },
  { key: 'low', emoji: '😔', color: '#6C8EBF' },
  { key: 'sad', emoji: '😢', color: '#7A6BB0' },
];

export const moodOf = (key?: MoodKey) => MOODS.find((m) => m.key === key);
