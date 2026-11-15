# Design notes

Short notes on the main design decisions in My Diary: the problem, the options considered, why
this one, and what it costs. The README's [Architecture](../README.md#architecture) section shows
the resulting design; this file is about the reasoning.

## 1. Local-only, no backend (for v1)

- **Problem:** A diary is private and the app has to work offline, anywhere.
- **Options:** (a) account + server from day one; (b) on-device only with manual backup;
  (c) on-device plus a third-party sync (iCloud / Google Drive APIs).
- **Chosen:** (b). No account, no network calls, no server to run or pay for, and nothing to leak.
- **Trade-off:** A lost phone without a backup means a lost diary, and there's no multi-device
  use. Mitigated by one-tap backup/restore, and by shaping the data for a later sync (§7).

## 2. JSON files instead of AsyncStorage or SQLite

- **Problem:** Years of daily entries must fit and load quickly; the first version used
  AsyncStorage, which Android caps at 6 MB in total.
- **Options:** keep AsyncStorage; SQLite (`expo-sqlite`); one JSON file per collection; one file
  per entry.
- **Chosen:** one JSON file each for entries and letters, photos as separate files.
- **Why:** The whole diary is loaded at start anyway (calendar, "On this day"), it's a few MB of
  text even after years, and a plain file is easy to back up, inspect and make crash-safe.
  SQLite brings schema migrations and a native dependency for little gain at this size.
- **Trade-off:** Every save rewrites the whole file (O(n)), and there are no queries or indexes.
  Fine for thousands of entries; tens of thousands with frequent saves would call for SQLite or
  per-entry files.

## 3. Atomic save: write a temp file, then rename

- **Problem:** The OS can kill the app at any moment. Writing `entries.json` in place can leave
  half a JSON document, which would lose everything.
- **Options:** write in place; write a temp file and rename it over the original; keep a
  write-ahead log or rotating backups.
- **Chosen:** temp file + rename (`entries.json.tmp` → `entries.json`).
- **Why:** A rename within one folder is atomic on POSIX file systems, so a reader sees the old
  file or the new one, never a mix. It's the standard technique (editors, databases, package
  managers) and needs no extra format.
- **Subtlety:** If a platform implements "move with overwrite" as delete-then-rename, there's a
  moment with no `entries.json` but a complete `.tmp`. Loading handles exactly that case: no real
  file + a temp file that parses → use the temp file; a temp file that doesn't parse is ignored.
- **Trade-off:** No `fsync` is exposed by the file API, so after a sudden power loss the OS could
  still lose the last few writes; the rename protects against the app being killed, which is the
  common case. A crash before the rename loses only the save in progress.

## 4. Fail-safe loading: throw, don't start empty

- **Problem:** The usual `try { load } catch { return [] }` turns one unreadable file into an empty
  diary, and the next save then overwrites the real data with nothing.
- **Chosen:** Only "nothing saved yet" becomes `[]`. Anything else (unreadable, not JSON, not a
  list) throws; the app shows a "couldn't open your diary" screen with a retry and saves nothing.
- **Trade-off:** In the rare damaged-file case the user is blocked instead of seeing an empty app.
  That's the right way round for a diary: a blocked app can be fixed, overwritten memories can't.
  Settings, by contrast, fall back to defaults — except the lock, which fails *closed* (on).

## 5. Migrations: upgrade on read, keep the original

- **Problem:** Storage moved from AsyncStorage to files, and records changed shape (v2 stores a
  photo's file name instead of its full `file://` path, which breaks after a reinstall).
- **Chosen:** Upgrade each record as it's read (pure functions that only add or convert fields,
  never drop a record, and leave unknown records untouched). The first time an upgrade changes
  anything, the list exactly as stored is copied to `entries.before-v2.json`, once. The AsyncStorage
  copy is never deleted, and the file copy is verified by reading it back.
- **Trade-off:** A little extra disk space and upgrade code that runs on every load, in exchange
  for every migration being reversible.

## 6. Backup format and versioning

- **Problem:** Backups outlive app versions: a file made today must restore in a year, and an old
  app may meet a newer file.
- **Chosen:** One JSON file `{ app, version, exportedAt, entries, letters }` with photos embedded
  as base64. Rules: new optional fields don't change the version (old readers ignore them, new
  readers default them); a breaking change bumps `version`, and readers refuse versions newer than
  they know. Every imported item is rebuilt field by field, because the file is untrusted input:
  invalid items are skipped and counted, unknown fields dropped, photo names checked so they can't
  escape the photos folder. Export is written one entry at a time to keep memory flat.
- **Options considered:** a zip with a manifest and photo files (smaller, streamable, but needs a
  zip library and is harder to inspect); one file per entry.
- **Trade-off:** base64 makes photos ~33% bigger and the import reads the whole file into memory,
  so very large photo libraries are slow. Listed in Future Work.

## 7. A data model that's ready for sync

- **Problem:** No server now, but adding sync later shouldn't need a data migration.
- **Chosen:** ids generated on the device; `createdAt` and `updatedAt` on every record; deletes as
  tombstones (an emptied record with `deletedAt`, content cleared for privacy); photo references by
  file name; calendar days as local `YYYY-MM-DD` strings.
- **Why:** These are what a last-writer-wins sync needs: stable identity across devices, a way to
  pick the newer version, and a way to tell "deleted here" from "never uploaded".
- **Trade-off:** Tombstones stay in storage forever (small: ids and timestamps only), and screens
  must always filter them — done once in `App.tsx` so screens only ever see live records.

## 8. Restore is additive and idempotent

- **Problem:** Restoring must never destroy what's on the phone, and people tap "restore" twice.
- **Chosen:** Merge by id: existing records win, new ones are added, a repeated id counts once, so a
  second import changes nothing. One exception: if the record was *deleted* on this phone, restoring
  it brings it back with `updatedAt = now`, so a future sync treats the restore as newer than the
  delete.
- **Trade-off:** A restore can't update an entry that was edited on another phone; the local copy
  always wins. Acceptable for a backup feature; real conflict handling belongs to sync.

## 9. Dates: local days vs moments

- **Problem:** "Which day was this written" is a calendar question, not an instant. Storing UTC
  timestamps for entry dates puts late-night entries on the wrong day and moves them when the user
  travels.
- **Chosen:** Entries store a local day key (`YYYY-MM-DD`); only things that happen at a moment
  (a letter opening at 10 PM) store a timestamp. Day math goes through `Date` calendar setters
  (`setDate(d + 1)`, month clamping for Jan 31 + 1 month = Feb 28), never `+ 86_400_000`, which
  breaks on 23- and 25-hour DST days.
- **Verified by:** tests that compare day keys with `Intl` for every half hour across both DST
  changes, run in 6 time zones from UTC−11 to UTC+14.
- **Trade-off:** A day key has no time zone, so an entry written in Seoul shows the Seoul date even
  after flying to Seattle — which is what a diary should do.

## 10. Notifications

- **Problem:** Letters unlock at a set time, possibly years away, and must announce it reliably.
- **Chosen:** Local notifications only, re-synced from the data (cancel this app's letter
  notifications, schedule the soonest 50) at launch, after sealing, after a restore and after a
  language change. Syncs are queued so two can't interleave and double-schedule. The module is
  loaded lazily because it crashes Expo Go on Android.
- **Why 50:** iOS keeps at most 64 pending notifications per app and silently drops the rest.
- **Trade-off:** Letters beyond the 50th get their notification on a later launch; the letter still
  unlocks in the app on time regardless.

## 11. Testing strategy

- **Problem:** The riskiest code (storage, backup, dates) depends on the file system, native
  modules and the clock.
- **Chosen:** Unit tests on the logic modules with an in-memory `expo-file-system` mock that can
  simulate the app being killed mid-write or before the rename; native modules mocked; a fixed
  default time zone plus a runner that repeats the date tests in 6 zones (Node reads `TZ` at process
  start, so each zone is its own Jest run). Coverage is measured on the logic modules with a CI
  threshold; screens are tested by hand.
- **Trade-off:** The mock tests my assumptions about the file system API, not the real device
  behaviour, and there are no UI or end-to-end tests yet (Future Work).

## 12. App lock

- Covers the app (doesn't unmount it), so a half-written entry survives re-locking.
- Hides content as soon as the app leaves the foreground, so the app-switcher snapshot is blank.
- If the phone's own screen lock is removed later, the diary opens instead of locking the owner
  out forever. If settings can't be read, the lock is assumed on (fail closed).

---

## Likely interview questions

**1. Why not SQLite?**
The whole diary is read at launch anyway and is a few MB at most, so a JSON file is simpler to make
crash-safe, back up and migrate. I'd switch when saves become slow (whole-file rewrite is O(n)) or
I need queries such as full-text search. (§2)

**2. What happens if the app is killed in the middle of a save?**
Walk through the three crash points: during the temp write (real file untouched, half temp
ignored), between write and rename (real file is the previous version), during a delete-then-move
(complete temp file is recovered on next load). Mention the tests that inject each crash. (§3)

**3. Why throw instead of returning an empty list when the file is corrupt?**
Because the next save would overwrite the real data. Fail-safe means the failure mode is "blocked",
not "data gone". Contrast with settings, where defaults are fine, except the lock fails closed. (§4)

**4. How do you change the backup format without breaking old backups?**
Additive optional fields with defaults keep the version; breaking changes bump it and old apps
refuse newer files. Tolerant reader, strict validation per item. Show the "old v1 file" tests. (§6)

**5. How would you add cloud sync?**
The model is ready: device ids, `updatedAt`, tombstones. Start with last-writer-wins per record:
push records with `updatedAt` newer than the last sync, pull the server's changes, merge by id
keeping the higher `updatedAt`, tombstones included. Photos uploaded separately by name. Then
discuss clock skew (server timestamps or hybrid logical clocks) and field-level conflicts. (§7)

**6. Why are deletes soft?**
So a sync can tell "deleted on this phone" from "not uploaded yet"; otherwise deleted entries come
back from the server. Content is cleared for privacy; only id and timestamps remain. (§7)

**7. Name a bug the tests found.**
Backup import only checked `version > 1`, so files with no version or `"version": "one"` were
accepted. And Feb 29 entries never resurfaced in non-leap years. Both were caught by writing the
boundary tests first, then fixed. (CHANGELOG)

**8. How do you test time zones and DST?**
Day keys instead of timestamps for calendar days, calendar arithmetic instead of adding 24h, and a
runner that executes the date suites under 6 `TZ` values because Node fixes the zone at process
start. (§9, §11)

**9. What would you do differently / what's missing?**
UI and end-to-end tests, encrypted backups, a streaming zip backup for large photo libraries, and
moving state out of the large `App.tsx` into a reducer or store if it keeps growing. Being honest
about the `fsync` limitation. (§3, §6)

**10. Why no state management library?**
One screen tree and two collections; `App.tsx` owns the data and passes live records down, with
one `commit` function per collection that updates state and saves. A library would add more than
it removes at this size; the cost is a long `App.tsx`. (Future Work)
