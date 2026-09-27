import { GowunBatang_400Regular, GowunBatang_700Bold } from '@expo-google-fonts/gowun-batang';
import { NanumPenScript_400Regular } from '@expo-google-fonts/nanum-pen-script';
import PretendardMedium from '../assets/fonts/Pretendard-Medium.otf';
import PretendardRegular from '../assets/fonts/Pretendard-Regular.otf';
import PretendardSemiBold from '../assets/fonts/Pretendard-SemiBold.otf';

/*
 * The Korean typefaces. Each weight is its own family name: custom fonts must never be combined with
 * fontWeight, or Android ignores the weight / fakes a bold. Screens don't use these names directly —
 * they use the tokens in theme.tsx (fonts.body, fonts.uiSemiBold, …).
 */
export const FAMILY = {
  /** 고운바탕 — what people write: entry and letter text, memory cards. */
  body: 'GowunBatang_400Regular',
  bodyBold: 'GowunBatang_700Bold',
  /** Pretendard — everything around the writing: dates, buttons, tabs, settings. */
  ui: 'Pretendard-Regular',
  uiMedium: 'Pretendard-Medium',
  uiSemiBold: 'Pretendard-SemiBold',
  /** 나눔손글씨 펜 — only short accents ("1년 전", sealed letter titles), never long text. */
  accent: 'NanumPenScript_400Regular',
} as const;

/** Passed to useFonts() at startup. Pretendard ships only these three weights, to keep the app small. */
export const FONT_FILES = {
  [FAMILY.body]: GowunBatang_400Regular,
  [FAMILY.bodyBold]: GowunBatang_700Bold,
  [FAMILY.ui]: PretendardRegular,
  [FAMILY.uiMedium]: PretendardMedium,
  [FAMILY.uiSemiBold]: PretendardSemiBold,
  [FAMILY.accent]: NanumPenScript_400Regular,
};
