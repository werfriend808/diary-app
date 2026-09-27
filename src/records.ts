import { Entry, Letter } from './types';

/*
 * Deleting doesn't remove a record from storage: it becomes a "tombstone" that keeps only its id and
 * timestamps (plus the dates it belongs to), so a future server sync can tell a deletion apart from an
 * item that was simply never uploaded. Everything the user wrote is cleared. Screens only ever get
 * live records — App.tsx filters once with isLive and passes the result down.
 */

export const isLive = (item: { deletedAt?: number }) => item.deletedAt === undefined;

/** The emptied record left behind when an entry is deleted. The photo file itself must be deleted separately. */
export function deletedEntry(e: Entry, now: number): Entry {
  return { id: e.id, date: e.date, title: '', body: '', createdAt: e.createdAt, updatedAt: now, deletedAt: now };
}

/** The emptied record left behind when a letter is deleted. Its notification must be cancelled separately. */
export function deletedLetter(l: Letter, now: number): Letter {
  return {
    id: l.id,
    body: '',
    writtenOn: l.writtenOn,
    opensOn: l.opensOn,
    ...(l.opensAt !== undefined ? { opensAt: l.opensAt } : {}),
    createdAt: l.createdAt,
    updatedAt: now,
    deletedAt: now,
  };
}
