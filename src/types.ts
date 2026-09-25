export type MoodKey = 'great' | 'good' | 'okay' | 'low' | 'sad';

export interface Entry {
  id: string;
  /** Local calendar day the entry belongs to, formatted YYYY-MM-DD. */
  date: string;
  title: string;
  body: string;
  mood?: MoodKey;
  /** file:// URI of a photo copied into the app's private storage. */
  photoUri?: string;
  createdAt: number;
  updatedAt: number;
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
  createdAt: number;
}
