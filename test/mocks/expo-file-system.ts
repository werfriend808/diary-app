/*
 * In-memory stand-in for the parts of expo-file-system's File / Directory / Paths API the app uses.
 * Tests reset it with `fs.reset()` and can inject failures (e.g. a crash in the middle of a save)
 * through `fs.hooks`.
 */

type Part = string | MockFile | MockDirectory;

const ROOT = 'file:///';

class State {
  files = new Map<string, string>(); // uri -> content (base64 content is stored as written)
  dirs = new Set<string>();
  hooks: {
    /** Called before every write; throw to simulate the app being killed while writing. */
    beforeWrite?: (uri: string, content: string) => void;
    /** Called before a move; throw to simulate a crash between "temp written" and "renamed". */
    beforeMove?: (from: string, to: string) => void;
  } = {};

  reset() {
    this.files.clear();
    this.dirs.clear();
    this.dirs.add(`${ROOT}document`);
    this.dirs.add(`${ROOT}cache`);
    this.hooks = {};
  }

  /** Test helpers working with paths relative to the document folder, e.g. "data/entries.json". */
  read(rel: string) {
    return this.files.get(`${ROOT}document/${rel}`);
  }
  put(rel: string, content: string) {
    const uri = `${ROOT}document/${rel}`;
    this.dirs.add(uri.slice(0, uri.lastIndexOf('/')));
    this.files.set(uri, content);
  }
  has(rel: string) {
    return this.files.has(`${ROOT}document/${rel}`);
  }
  list(relDir: string) {
    const prefix = `${ROOT}document/${relDir}/`;
    return [...this.files.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  }
}

export const fs = new State();
fs.reset();

function join(parts: Part[]): string {
  const segments: string[] = [];
  for (const p of parts) {
    const s = typeof p === 'string' ? p : p.uri;
    segments.push(s.replace(/\/+$/, ''));
  }
  let uri = segments.join('/');
  if (!uri.startsWith('file://')) uri = `${ROOT}${uri.replace(/^\/+/, '')}`;
  return uri.replace(/([^:])\/{2,}/g, '$1/');
}

const parentOf = (uri: string) => uri.slice(0, uri.lastIndexOf('/'));

export class MockDirectory {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get name() {
    return this.uri.slice(this.uri.lastIndexOf('/') + 1);
  }
  get exists() {
    return fs.dirs.has(this.uri);
  }
  create(opts?: { intermediates?: boolean }) {
    if (!opts?.intermediates && !fs.dirs.has(parentOf(this.uri))) throw new Error(`No parent for ${this.uri}`);
    let cur = this.uri;
    while (cur.length > ROOT.length) {
      fs.dirs.add(cur);
      cur = parentOf(cur);
    }
  }
  list(): (MockDirectory | MockFile)[] {
    const prefix = `${this.uri}/`;
    const out: (MockDirectory | MockFile)[] = [];
    for (const k of fs.files.keys()) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) out.push(new MockFile(k));
    }
    for (const d of fs.dirs) {
      if (d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.push(new MockDirectory(d));
    }
    return out;
  }
}

export class MockFile {
  readonly uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get name() {
    return this.uri.slice(this.uri.lastIndexOf('/') + 1);
  }
  get extension() {
    const n = this.name;
    const i = n.lastIndexOf('.');
    return i > 0 ? n.slice(i) : '';
  }
  get exists() {
    return fs.files.has(this.uri);
  }
  private content() {
    const c = fs.files.get(this.uri);
    if (c === undefined) throw new Error(`File not found: ${this.uri}`);
    return c;
  }
  textSync() {
    return this.content();
  }
  async text() {
    return this.content();
  }
  /** Stored content is treated as the base64 form when it was written with encoding: 'base64'. */
  async base64() {
    return this.content();
  }
  create(opts?: { overwrite?: boolean }) {
    if (!fs.dirs.has(parentOf(this.uri))) throw new Error(`Folder missing for ${this.uri}`);
    if (this.exists && !opts?.overwrite) throw new Error(`File exists: ${this.uri}`);
    fs.files.set(this.uri, '');
  }
  write(content: string, opts?: { append?: boolean; encoding?: string }) {
    if (!fs.dirs.has(parentOf(this.uri))) throw new Error(`Folder missing for ${this.uri}`);
    const next = opts?.append ? (fs.files.get(this.uri) ?? '') + content : content;
    if (fs.hooks.beforeWrite) {
      try {
        fs.hooks.beforeWrite(this.uri, content);
      } catch (e) {
        // A crash mid-write leaves a truncated file behind, like a real phone would.
        fs.files.set(this.uri, next.slice(0, Math.floor(next.length / 2)));
        throw e;
      }
    }
    fs.files.set(this.uri, next);
  }
  moveSync(dest: MockFile, opts?: { overwrite?: boolean }) {
    fs.hooks.beforeMove?.(this.uri, dest.uri);
    if (dest.exists && !opts?.overwrite) throw new Error(`Destination exists: ${dest.uri}`);
    fs.files.set(dest.uri, this.content());
    fs.files.delete(this.uri);
  }
  async copy(dest: MockFile) {
    fs.files.set(dest.uri, this.content());
  }
  delete() {
    if (!fs.files.delete(this.uri)) throw new Error(`File not found: ${this.uri}`);
  }
}

export const Paths = {
  document: new MockDirectory(`${ROOT}document`),
  cache: new MockDirectory(`${ROOT}cache`),
};

export { MockDirectory as Directory, MockFile as File };
