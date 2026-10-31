import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { parseRecipe, type PhotoRecipe } from '../photo/recipe';
import type { AlbumPhoto, PhotoKind } from './album-types';

/**
 * The in-app album (ALB-01): a SQLite table of photos and, per photo, a folder
 * with the rendered output and the original. Everything stays in the app sandbox.
 */
const SCHEMA_VERSION = 2;
const ALBUM_ROOT = new Directory(Paths.document, 'album');

interface PhotoRow {
  id: string;
  kind: string;
  created_at: number;
  updated_at: number;
  width: number;
  height: number;
  recipe: string | null;
  has_original: number;
  original_expires_at: number | null;
  /** When the current original was kept: the shot, or adopting the output later. */
  original_since: number;
}

let database: SQLiteDatabase | undefined;
const listeners = new Set<() => void>();

function db(): SQLiteDatabase {
  if (database === undefined) {
    database = openDatabaseSync('album.db');
    migrate(database);
  }
  return database;
}

function migrate(target: SQLiteDatabase): void {
  const row = target.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    target.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        recipe TEXT,
        has_original INTEGER NOT NULL,
        original_expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS photos_created_at ON photos (created_at DESC);
      PRAGMA user_version = 1;
    `);
  }
  if (version < 2) {
    // Retention counts from when an original was kept, which for an adopted output
    // is not when the photo was taken.
    target.withTransactionSync(() => {
      target.execSync(`
        ALTER TABLE photos ADD COLUMN original_since INTEGER NOT NULL DEFAULT 0;
        UPDATE photos SET original_since = created_at;
        PRAGMA user_version = ${String(SCHEMA_VERSION)};
      `);
    });
  }
}

function photoDirectory(id: string): Directory {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid photo id: ${id}`);
  return new Directory(ALBUM_ROOT, id);
}

function outputFile(id: string): File {
  return new File(photoDirectory(id), 'output.jpg');
}

function originalFile(id: string): File {
  return new File(photoDirectory(id), 'original.jpg');
}

/** A video's file (CAM-13); its output is then the first frame, for the grid. */
function videoFile(id: string): File {
  return new File(photoDirectory(id), 'video.mp4');
}

/**
 * Where a new video's file goes, so it can be written there before its row is added.
 * `discardPhotoFiles` cleans up if that fails.
 */
export function prepareVideoFile(id: string): string {
  photoDirectory(id).create({ intermediates: true, idempotent: true });
  return videoFile(id).uri;
}

function toPhoto(row: PhotoRow): AlbumPhoto {
  const hasOriginal = row.has_original === 1;
  return {
    id: row.id,
    kind: row.kind as PhotoKind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    width: row.width,
    height: row.height,
    recipe: parseRecipe(row.recipe),
    hasOriginal,
    originalExpiresAt: row.original_expires_at,
    outputUri: outputFile(row.id).uri,
    originalUri: hasOriginal ? originalFile(row.id).uri : null,
    videoUri: row.kind === 'video' ? videoFile(row.id).uri : null,
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Re-renders subscribers (e.g. the album grid) after any change. */
export function subscribeAlbum(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listPhotos(): AlbumPhoto[] {
  return db().getAllSync<PhotoRow>('SELECT * FROM photos ORDER BY created_at DESC').map(toPhoto);
}

export function getPhoto(id: string): AlbumPhoto | null {
  const row = db().getFirstSync<PhotoRow>('SELECT * FROM photos WHERE id = ?', id);
  return row === null ? null : toPhoto(row);
}

/**
 * Writes the original of a new photo first, so face detection can read it while the
 * photo renders. `discardPhotoFiles` cleans up if rendering fails.
 */
export function writeOriginal(id: string, bytes: Uint8Array): string {
  photoDirectory(id).create({ intermediates: true, idempotent: true });
  const file = originalFile(id);
  file.writeSync(bytes);
  return file.uri;
}

export function discardPhotoFiles(id: string): void {
  const directory = photoDirectory(id);
  if (directory.exists) directory.delete();
}

export interface NewPhoto {
  readonly id: string;
  readonly kind: PhotoKind;
  readonly output: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Whether `writeOriginal` was called for this photo. */
  readonly hasOriginal: boolean;
  readonly recipe: PhotoRecipe | null;
  /** Days to keep the original; `null` keeps it forever. */
  readonly originalRetentionDays: number | null;
}

/** Writes the output and then the row, so the album never lists a photo without files. */
export function addPhoto(photo: NewPhoto, now = Date.now()): AlbumPhoto {
  photoDirectory(photo.id).create({ intermediates: true, idempotent: true });
  try {
    outputFile(photo.id).writeSync(photo.output);
    db().runSync(
      'INSERT INTO photos (id, kind, created_at, updated_at, width, height, recipe, has_original, original_expires_at, original_since) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      photo.id,
      photo.kind,
      now,
      now,
      photo.width,
      photo.height,
      photo.recipe === null ? null : JSON.stringify(photo.recipe),
      photo.hasOriginal ? 1 : 0,
      expiryOf(photo.hasOriginal, photo.originalRetentionDays, now),
      now,
    );
  } catch (error) {
    discardPhotoFiles(photo.id);
    throw error;
  }
  notify();
  const added = getPhoto(photo.id);
  if (added === null) throw new Error('Photo was not saved');
  return added;
}

function expiryOf(hasOriginal: boolean, retentionDays: number | null, from: number): number | null {
  return !hasOriginal || retentionDays === null ? null : from + retentionDays * 24 * 60 * 60 * 1000;
}

/**
 * Makes the current output the new original of a photo whose original expired, so
 * it can be edited again (starting from how it looks now).
 */
export function adoptOutputAsOriginal(
  id: string,
  retentionDays: number | null,
  now = Date.now(),
): string {
  outputFile(id).copySync(originalFile(id));
  db().runSync(
    'UPDATE photos SET has_original = 1, original_expires_at = ?, original_since = ? WHERE id = ?',
    expiryOf(true, retentionDays, now),
    now,
    id,
  );
  notify();
  return originalFile(id).uri;
}

/** Replaces the rendered output and recipe after an edit (EDT-*, DCO-*). */
export function updatePhoto(
  id: string,
  update: {
    readonly output: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly recipe: PhotoRecipe | null;
  },
): void {
  outputFile(id).writeSync(update.output);
  db().runSync(
    'UPDATE photos SET updated_at = ?, width = ?, height = ?, recipe = ? WHERE id = ?',
    Date.now(),
    update.width,
    update.height,
    update.recipe === null ? null : JSON.stringify(update.recipe),
    id,
  );
  notify();
}

/** Deletes photos and their files (ALB-02). */
export function deletePhotos(ids: readonly string[]): void {
  if (ids.length === 0) return;
  db().withTransactionSync(() => {
    for (const id of ids) db().runSync('DELETE FROM photos WHERE id = ?', id);
  });
  for (const id of ids) discardPhotoFiles(id);
  notify();
}

/**
 * Deletes originals past their retention (ALB-03). Their photos stay, and edits
 * then start from the rendered output.
 */
export function purgeExpiredOriginals(now = Date.now()): number {
  const expired = db().getAllSync<{ id: string }>(
    'SELECT id FROM photos WHERE has_original = 1 AND original_expires_at IS NOT NULL AND original_expires_at <= ?',
    now,
  );
  for (const { id } of expired) {
    const file = originalFile(id);
    if (file.exists) file.delete();
    db().runSync('UPDATE photos SET has_original = 0, original_expires_at = NULL WHERE id = ?', id);
  }
  if (expired.length > 0) notify();
  return expired.length;
}

/**
 * Deletes photo folders without a row: left behind when the app was killed between
 * writing a new photo's files and adding it. Run at launch, before anything is shot.
 */
export function removeOrphanFiles(): number {
  if (!ALBUM_ROOT.exists) return 0;
  const known = new Set(
    db()
      .getAllSync<{ id: string }>('SELECT id FROM photos')
      .map(({ id }) => id),
  );
  let removed = 0;
  for (const entry of ALBUM_ROOT.list()) {
    if (entry instanceof Directory && !known.has(entry.name)) {
      entry.delete();
      removed++;
    }
  }
  return removed;
}

/** Applies a new retention setting to the originals already kept. */
export function applyOriginalRetention(retentionDays: number | null): void {
  if (retentionDays === null) {
    db().runSync('UPDATE photos SET original_expires_at = NULL WHERE has_original = 1');
  } else {
    db().runSync(
      'UPDATE photos SET original_expires_at = original_since + ? WHERE has_original = 1',
      retentionDays * 24 * 60 * 60 * 1000,
    );
  }
  purgeExpiredOriginals();
}
