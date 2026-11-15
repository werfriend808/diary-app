import { Entry, Letter } from '../src/types';

let seq = 0;

export function makeEntry(over: Partial<Entry> = {}): Entry {
  seq++;
  return {
    id: `e${seq}`,
    date: '2026-03-14',
    title: `Title ${seq}`,
    body: `Body ${seq}`,
    createdAt: 1_700_000_000_000 + seq,
    updatedAt: 1_700_000_000_000 + seq,
    ...over,
  };
}

export function makeLetter(over: Partial<Letter> = {}): Letter {
  seq++;
  return {
    id: `l${seq}`,
    body: `Dear future me ${seq}`,
    writtenOn: '2026-03-14',
    opensOn: '2027-03-14',
    createdAt: 1_700_000_000_000 + seq,
    updatedAt: 1_700_000_000_000 + seq,
    ...over,
  };
}
