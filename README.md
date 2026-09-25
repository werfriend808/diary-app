# My Diary

A simple diary app for phones, built with Expo (React Native).

- Write entries with a title, text, and a date. You can move the date to earlier days.
- Pick a mood for each entry (😄 🙂 😐 😔 😢).
- Browse a calendar that shows a colored dot on each day you wrote. Tap a day to see its entries.
- Attach a photo from your gallery.
- **On this day:** the top of the Diary tab brings back what you wrote one week ago, the same
  day in earlier months, and this date in earlier years.
- **Letters to future you:** write a letter, seal it for 1 month to 3 years, and open it when
  the day comes. A banner and a dot on the Letters tab tell you when one is ready.
- Everything is stored privately on your phone, with no account and no internet needed.

## Run it on your phone with Expo Go

**Expo Go** is a free app from the App Store / Google Play. It runs Expo projects straight
from your computer while you're developing, so you don't have to build or install anything
on the phone. Your PC runs a small dev server, your phone scans a QR code, and the app opens
inside Expo Go. When you save a code change, the app on the phone reloads by itself.

1. **On your phone:** install **Expo Go** from the App Store or Google Play.
2. **On your PC:** install [Node.js](https://nodejs.org) (the LTS version) if you don't have it.
3. Open a terminal in this folder and run:

   ```bash
   npm install
   npx expo start
   ```

4. A QR code appears in the terminal.
   - **Android:** open Expo Go and tap *Scan QR code*.
   - **iPhone:** open the normal Camera app and point it at the QR code.
5. Your phone and PC must be on the **same Wi-Fi**. If it can't connect (office or school
   networks often block this), run `npx expo start --tunnel` instead.

> If Expo Go says the project needs a newer SDK, update Expo Go from the store. This project
> uses Expo SDK 57.

## Project layout

```
App.tsx                      App shell: tabs, + button, which screen is showing
src/
  screens/EntryListScreen    List of all entries, newest first
  screens/CalendarScreen     Month grid with mood dots + that day's entries
  screens/EditorScreen       Write / edit / delete an entry, mood, photo
  screens/LettersScreen      Ready / sealed / opened letters
  screens/LetterComposerScreen  Write and seal a letter to future you
  screens/LetterReaderScreen    Read an opened letter
  components/MemoriesSection "On this day" cards + ready-letter banner
  memories.ts                Decides which old entries to resurface today
  components/EntryCard       One entry row (date, mood, title, preview, thumbnail)
  storage.ts                 Saves entries (AsyncStorage) and photos (app documents folder)
  theme.ts                   Colors and the list of moods
  dates.ts                   Date helpers
```

## Ideas for next steps

- Search entries
- Notification on the day a letter unlocks, and a gentle "a year ago today" reminder
- Monthly and yearly recaps
- Lock the diary with Face ID / fingerprint (`expo-local-authentication`)
- Daily reminder notification (`expo-notifications`)
- Dark mode
- Export / back up entries
