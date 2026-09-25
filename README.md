# My Diary

**A private diary that gives your memories back to you.**

Write about your day, as long or as short as you like. Over time the app starts showing you
what you wrote a week, a month, or a year ago, and lets you send letters to your future self
that stay sealed until the day you choose.

Everything stays on your phone. No account, no ads, no internet needed.

<p>
  <img src="docs/screenshots/diary.png" width="200" alt="Diary tab with On this day memories" />
  <img src="docs/screenshots/letters.png" width="200" alt="Letters tab" />
  <img src="docs/screenshots/letter.png" width="200" alt="An opened letter" />
  <img src="docs/screenshots/compose.png" width="200" alt="Writing a letter to future you" />
</p>

<sub>Screenshots use sample entries.</sub>

## Features

### Write
- Diary entries with a title, text, date, and an optional photo
- A mood for each day (😄 🙂 😐 😔 😢)
- A calendar with a mood-colored dot on each day you wrote

### Look back
- **On this day:** the top of the Diary tab brings back entries from one week ago, the same
  day in earlier months, and this date in earlier years. They appear as paper-style cards you
  swipe through.
- **Letters to future you:** write a letter and seal it for 1 month, 3 months, 6 months,
  1 year, or 3 years. You can't read it until then. When it's ready, a banner and a dot on
  the Letters tab let you know.

## Tech

- [Expo](https://expo.dev) SDK 57 / React Native, TypeScript
- Entries and letters are stored on the device with AsyncStorage; photos are copied into the
  app's private documents folder (`expo-file-system`)
- No backend, no analytics, no network calls

## Run it

You need [Node.js](https://nodejs.org) (LTS) on your computer and the free **Expo Go** app
on your phone (App Store / Google Play).

```bash
npm install
npx expo start
```

Scan the QR code: with Expo Go on Android, or with the Camera app on iPhone. Your phone and
computer must be on the same Wi-Fi. If it won't connect, use `npx expo start --tunnel`.

Type check:

```bash
npx tsc --noEmit
```

## Project layout

```
App.tsx                           Tabs, the + button, and which screen is showing
src/
  screens/
    EntryListScreen.tsx           Diary tab: memories on top, then all entries
    CalendarScreen.tsx            Month grid with mood dots and that day's entries
    EditorScreen.tsx              Write, edit, or delete an entry
    LettersScreen.tsx             Ready, sealed, and opened letters
    LetterComposerScreen.tsx      Write and seal a letter
    LetterReaderScreen.tsx        Read an opened letter
  components/
    MemoriesSection.tsx           "On this day" cards and the ready-letter banner
    EntryCard.tsx                 One entry row in a list
  memories.ts                     Picks which old entries to bring back today
  storage.ts                      Saving entries, letters, and photos
  dates.ts                        Date helpers
  theme.ts                        Colors, fonts, and moods
  types.ts                        Entry and Letter types
```

## Roadmap

Before launch
- [ ] Final app name, icon, and splash screen
- [ ] Backup and export, so a lost phone doesn't mean a lost diary
- [ ] App lock with Face ID or fingerprint
- [ ] Notification when a letter unlocks
- [ ] Dark mode
- [ ] Privacy policy page
- [ ] App Store and Google Play release (EAS Build)

Later
- [ ] Monthly and yearly recaps
- [ ] "Same day across the years" view
- [ ] Search
- [ ] Optional cloud sync
