import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseSync } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { neutralRecipe } from '../photo/recipe';
import {
  addPhoto,
  adoptOutputAsOriginal,
  applyOriginalRetention,
  deletePhotos,
  getPhoto,
  listPhotos,
  prepareVideoFile,
  purgeExpiredOriginals,
  removeOrphanFiles,
  subscribeAlbum,
  updatePhoto,
  writeOriginal,
  type NewPhoto,
} from './album-db';

const DAY = 24 * 60 * 60 * 1000;
const OUTPUT = new Uint8Array([1, 2, 3]);
const ORIGINAL = new Uint8Array([9, 9]);

function newPhoto(patch: Partial<NewPhoto> = {}): NewPhoto {
  return {
    id: 'photo-1',
    kind: 'camera',
    output: OUTPUT,
    width: 300,
    height: 400,
    hasOriginal: false,
    recipe: null,
    originalRetentionDays: 30,
    ...patch,
  };
}

/** A camera photo with its original, as the shutter stores it. */
function shoot(id: string, at: number, retentionDays: number | null = 30) {
  writeOriginal(id, ORIGINAL);
  return addPhoto(
    newPhoto({
      id,
      hasOriginal: true,
      recipe: neutralRecipe(0.75),
      originalRetentionDays: retentionDays,
    }),
    at,
  );
}

function photoFolder(id: string): Directory {
  return new Directory(Paths.document, 'album', id);
}

describe('album-db', () => {
  beforeEach(() => {
    listPhotos(); // creates the table on first use
    openDatabaseSync('album.db').execSync('DELETE FROM photos');
  });

  it('stores a photo with its output and lists the newest first', () => {
    addPhoto(newPhoto({ id: 'older' }), 1000);
    const added = addPhoto(newPhoto({ id: 'newer', recipe: neutralRecipe(0.5) }), 2000);

    expect(listPhotos().map(({ id }) => id)).toEqual(['newer', 'older']);
    expect(added).toMatchObject({
      id: 'newer',
      kind: 'camera',
      createdAt: 2000,
      updatedAt: 2000,
      width: 300,
      height: 400,
      recipe: neutralRecipe(0.5),
      hasOriginal: false,
      originalExpiresAt: null,
      originalUri: null,
      videoUri: null,
    });
    expect(new File(added.outputUri).bytesSync()).toEqual(OUTPUT);
    expect(getPhoto('missing')).toBeNull();
  });

  it('keeps an original until its retention ends', () => {
    const photo = shoot('kept', 1000, 30);

    expect(photo.hasOriginal).toBe(true);
    expect(photo.originalExpiresAt).toBe(1000 + 30 * DAY);
    expect(new File(photo.originalUri ?? '').bytesSync()).toEqual(ORIGINAL);
    expect(shoot('forever', 1000, null).originalExpiresAt).toBeNull();
  });

  it('leaves no files behind when the row cannot be added', () => {
    expect(() => addPhoto(newPhoto({ id: 'broken', width: null as unknown as number }))).toThrow();

    expect(photoFolder('broken').exists).toBe(false);
    expect(listPhotos()).toEqual([]);
  });

  it('refuses IDs that could reach outside the album', () => {
    expect(() => addPhoto(newPhoto({ id: '../settings' }))).toThrow('Invalid photo id');
    expect(() => getPhoto('../settings')).not.toThrow();
  });

  it('gives a video its file', () => {
    const uri = prepareVideoFile('clip');
    new File(uri).writeSync(new Uint8Array([0]));

    const video = addPhoto(newPhoto({ id: 'clip', kind: 'video' }));

    expect(video.videoUri).toBe(uri);
  });

  it('replaces the output and recipe after an edit', () => {
    shoot('edited', 1000);

    updatePhoto('edited', {
      output: new Uint8Array([7]),
      width: 100,
      height: 100,
      recipe: neutralRecipe(0.25),
    });

    const photo = getPhoto('edited');
    expect(photo).toMatchObject({ width: 100, height: 100, recipe: neutralRecipe(0.25) });
    expect(photo?.updatedAt).toBeGreaterThan(1000);
    expect(new File(photo?.outputUri ?? '').bytesSync()).toEqual(new Uint8Array([7]));
  });

  it('deletes photos with their files', () => {
    shoot('a', 1000);
    shoot('b', 2000);

    deletePhotos(['a']);
    deletePhotos([]);

    expect(listPhotos().map(({ id }) => id)).toEqual(['b']);
    expect(photoFolder('a').exists).toBe(false);
    expect(photoFolder('b').exists).toBe(true);
  });

  it('deletes expired originals but keeps their photos', () => {
    const expired = shoot('expired', 0, 30);
    shoot('fresh', 20 * DAY, 30);
    shoot('forever', 0, null);

    expect(purgeExpiredOriginals(31 * DAY)).toBe(1);

    expect(getPhoto('expired')).toMatchObject({
      hasOriginal: false,
      originalExpiresAt: null,
      originalUri: null,
    });
    expect(new File(expired.originalUri ?? '').exists).toBe(false);
    expect(new File(expired.outputUri).exists).toBe(true);
    expect(getPhoto('fresh')?.hasOriginal).toBe(true);
    expect(getPhoto('forever')?.hasOriginal).toBe(true);
    expect(purgeExpiredOriginals(31 * DAY)).toBe(0);
  });

  it('applies a new retention to the originals already kept', () => {
    const now = Date.now();
    shoot('old', now - 60 * DAY, null);
    shoot('recent', now - 10 * DAY, null);

    applyOriginalRetention(30);

    expect(getPhoto('old')?.hasOriginal).toBe(false);
    expect(getPhoto('recent')).toMatchObject({
      hasOriginal: true,
      originalExpiresAt: now - 10 * DAY + 30 * DAY,
    });

    applyOriginalRetention(null);

    expect(getPhoto('recent')?.originalExpiresAt).toBeNull();
  });

  it('makes the output the original once the original is gone', () => {
    shoot('old', 0, 30);
    purgeExpiredOriginals(31 * DAY);

    const uri = adoptOutputAsOriginal('old', 30, 40 * DAY);

    expect(new File(uri).bytesSync()).toEqual(OUTPUT);
    expect(getPhoto('old')).toMatchObject({
      hasOriginal: true,
      originalUri: uri,
      originalExpiresAt: 70 * DAY,
    });
  });

  it('removes folders of photos that were never added', () => {
    shoot('saved', 1000);
    writeOriginal('interrupted', ORIGINAL);

    expect(removeOrphanFiles()).toBe(1);

    expect(photoFolder('interrupted').exists).toBe(false);
    expect(photoFolder('saved').exists).toBe(true);
  });

  it('tells subscribers about every change until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlbum(listener);

    shoot('a', 0);
    updatePhoto('a', { output: OUTPUT, width: 1, height: 1, recipe: null });
    purgeExpiredOriginals(31 * DAY);
    deletePhotos(['a']);
    unsubscribe();
    shoot('b', 0);

    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('counts the retention of an adopted original from when it was adopted', () => {
    const now = Date.now();
    shoot('old', now - 100 * DAY, 30);
    purgeExpiredOriginals(now);
    adoptOutputAsOriginal('old', 30, now - DAY);

    applyOriginalRetention(90);

    expect(getPhoto('old')).toMatchObject({
      hasOriginal: true,
      originalExpiresAt: now - DAY + 90 * DAY,
    });
  });

  it('upgrades an album saved by the first version', async () => {
    const shotAt = Date.now() - 10 * DAY;
    const database = openDatabaseSync('album.db');
    database.execSync(`
      DROP TABLE photos;
      CREATE TABLE photos (
        id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
        recipe TEXT, has_original INTEGER NOT NULL, original_expires_at INTEGER
      );
      INSERT INTO photos VALUES ('v1', 'camera', ${String(shotAt)}, ${String(shotAt)}, 3, 4, NULL, 1, NULL);
      PRAGMA user_version = 1;
    `);
    vi.resetModules();
    const album = await import('./album-db');

    album.applyOriginalRetention(60);

    // The kept original counts from the shot.
    expect(album.getPhoto('v1')?.originalExpiresAt).toBe(shotAt + 60 * DAY);
    expect(database.getFirstSync<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 2,
    });
  });
});
