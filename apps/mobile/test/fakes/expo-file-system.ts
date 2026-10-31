import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { downloads } from '../controls';
import { sharedState } from '../shared-state';

/**
 * `expo-file-system` on Node.js: real files under a temporary folder, with the
 * strictness of the native module (writing needs the folder, deleting needs the file).
 */
const ROOT = sharedState('fs-root', () => fs.mkdtempSync(path.join(tmpdir(), 'fant-fs-')));

interface DownloadOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: { bytesWritten: number; totalBytes: number }) => void;
}

type PathPart = string | Entry;

function toPath(part: PathPart): string {
  if (typeof part !== 'string') return part.path;
  return part.startsWith('file://') ? part.slice('file://'.length) : part;
}

abstract class Entry {
  readonly path: string;

  constructor(...parts: PathPart[]) {
    this.path = path.join(...parts.map(toPath));
  }

  get uri(): string {
    return `file://${this.path}`;
  }

  get name(): string {
    return path.basename(this.path);
  }
}

function destinationOf(source: File, destination: PathPart): string {
  return destination instanceof Directory
    ? path.join(destination.path, source.name)
    : toPath(destination);
}

export class File extends Entry {
  get exists(): boolean {
    return fs.existsSync(this.path) && fs.statSync(this.path).isFile();
  }

  writeSync(content: string | Uint8Array): void {
    fs.writeFileSync(this.path, content);
  }

  bytesSync(): Uint8Array {
    return new Uint8Array(fs.readFileSync(this.path));
  }

  textSync(): string {
    return fs.readFileSync(this.path, 'utf8');
  }

  delete(): void {
    fs.rmSync(this.path);
  }

  copySync(destination: File | Directory): void {
    fs.copyFileSync(this.path, destinationOf(this, destination));
  }

  moveSync(destination: File | Directory): void {
    fs.renameSync(this.path, destinationOf(this, destination));
  }

  digest(algorithm: 'SHA-256'): Promise<string> {
    const name = algorithm.replace('-', '').toLowerCase();
    return Promise.resolve(createHash(name).update(fs.readFileSync(this.path)).digest('hex'));
  }

  static async downloadFileAsync(
    url: string,
    destination: File,
    options: DownloadOptions = {},
  ): Promise<File> {
    const bytes = await downloads.handler(url, options);
    options.onProgress?.({ bytesWritten: bytes.length, totalBytes: bytes.length });
    if (options.signal?.aborted === true) throw new Error('Aborted');
    destination.writeSync(bytes);
    return destination;
  }
}

export class Directory extends Entry {
  get exists(): boolean {
    return fs.existsSync(this.path) && fs.statSync(this.path).isDirectory();
  }

  create(options: { intermediates?: boolean; idempotent?: boolean } = {}): void {
    if (this.exists && options.idempotent === true) return;
    fs.mkdirSync(this.path, { recursive: options.intermediates === true });
  }

  delete(): void {
    if (!this.exists) throw new Error(`Directory does not exist: ${this.path}`);
    fs.rmSync(this.path, { recursive: true });
  }

  list(): (File | Directory)[] {
    return fs
      .readdirSync(this.path, { withFileTypes: true })
      .map((entry) =>
        entry.isDirectory() ? new Directory(this, entry.name) : new File(this, entry.name),
      );
  }
}

export const Paths = {
  document: new Directory(ROOT, 'document'),
  cache: new Directory(ROOT, 'cache'),
};

/** Empties the app's folders between tests. */
export function resetFileSystem(): void {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(Paths.document.path, { recursive: true });
  fs.mkdirSync(Paths.cache.path, { recursive: true });
}
