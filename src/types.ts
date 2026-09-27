export type MoodKey = 'great' | 'good' | 'okay' | 'low' | 'sad';

export interface Entry {
  id: string;
  /** Local calendar day the entry belongs to, formatted YYYY-MM-DD. */
  date: string;
  title: string;
  body: string;
  mood?: MoodKey;
  /**
   * File name (not a path) of the entry's photo inside the app's photos folder, e.g. "1727312345678.jpg".
   * Turn it into something an <Image> can show with photoUrl() from storage.ts. Only the name is stored
   * because a full file:// path changes on another phone or after reinstalling the app.
   */
  photoName?: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Set when the entry is deleted. The record is kept — emptied down to its id and timestamps — so a
   * future sync can tell "deleted on this phone" from "not uploaded yet". Screens never show it.
   */
  deletedAt?: number;
}

export interface Letter {
  id: string;
  body: string;
  /** Day the letter was written, YYYY-MM-DD. */
  writtenOn: string;
  /** Day the letter unlocks, YYYY-MM-DD. */
  opensOn: string;
  /** Set the first time the letter is opened. */
  openedAt?: number;
  /** Id of the scheduled "your letter is ready" notification. */
  notificationId?: string;
  createdAt: number;
  /** Last change: sealing, opening or deleting. */
  updatedAt: number;
  /** Set when the letter is deleted; kept emptied, like Entry.deletedAt. */
  deletedAt?: number;
}
