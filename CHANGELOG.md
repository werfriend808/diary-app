# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-15

First complete version. Built September – November 2026.

### Added
- Diary entries with title, full-length text, date, mood, an optional photo and an optional
  place name (from one position fix; coordinates are never stored)
- Calendar with a mood-colored dot on each day
- "On this day": entries from one week, N months and N years ago
- Letters to future you: sealed for 1 week to 3 years or until a custom date and time, with a
  local notification that opens the letter
- App lock (Face ID / fingerprint / passcode), re-locking after a minute in the background
- Backup and restore: one JSON file with embedded photos; restore is additive and idempotent
- Dark mode; English and Korean
- Crash-safe storage: atomic temp-file-and-rename saves, recovery from an interrupted save,
  fail-safe loading that never replaces a damaged diary with an empty one, migration from
  AsyncStorage to files, tombstones and `updatedAt` on every record for a future sync
- 201 unit tests (Jest + jest-expo) with an in-memory file system that simulates crashes,
  date tests run in 6 time zones, GitHub Actions CI (lint, type check, tests)
- EAS Build configuration (`eas.json`) and permanent app ids (`com.werfriend808.mydiary`)

### Fixed
- Backup import accepted files whose `version` was missing, not a number, fractional or 0
- "On this day" never showed Feb 29 entries in non-leap years; they now appear on Feb 28

[1.0.0]: https://github.com/werfriend808/diary-app/releases/tag/v1.0.0
