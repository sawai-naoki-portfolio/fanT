import type { Film } from '@fant/content-schema';
import { File } from 'expo-file-system';

import { applyLut, encodeFrames, videoThumbnail } from '../../../modules/video-film/src';
import { bakeFilmLut } from '../../engine/video-lut';
import { tempDirectory } from '../../lib/temp-files';
import { track } from '../analytics/analytics';
import { addPhoto, discardPhotoFiles, prepareVideoFile } from '../album/album-db';
import type { AlbumPhoto } from '../album/album-types';
import { newPhotoId } from '../photo/photo-service';
import { useSettings } from '../settings/settings-store';

/** Longest video, in seconds (CAM-13). */
export const MAX_VIDEO_SECONDS = 15;

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Adds a video to the album: `write` puts the file in place, then its first frame
 * becomes the grid thumbnail. On failure nothing is left behind.
 */
async function addVideo(
  write: (target: string) => Promise<void>,
): Promise<{ readonly photo: AlbumPhoto; readonly durationMs: number }> {
  const id = newPhotoId();
  const thumbnail = new File(tempDirectory('video'), `${id}.jpg`);
  try {
    const video = prepareVideoFile(id);
    await write(video);
    const info = await videoThumbnail(video, thumbnail.uri);
    const photo = addPhoto({
      id,
      kind: 'video',
      output: thumbnail.bytesSync(),
      width: info.width,
      height: info.height,
      hasOriginal: false,
      recipe: null,
      originalRetentionDays: useSettings.getState().originalRetentionDays,
    });
    return { photo, durationMs: info.durationMs };
  } catch (error) {
    discardPhotoFiles(id);
    throw error;
  } finally {
    if (thumbnail.exists) thumbnail.delete();
  }
}

/**
 * Turns a raw recording into an album video (CAM-13): colours it with the film at
 * `intensity`, keeps its first frame for the grid, and deletes the raw file.
 */
export async function saveVideo(input: {
  readonly recording: string;
  readonly film: Film;
  readonly intensity: number;
}): Promise<AlbumPhoto> {
  const raw = new File(fileUri(input.recording));
  try {
    const lut = await bakeFilmLut(input.film, input.intensity);
    const { photo, durationMs } = await addVideo((target) => applyLut(raw.uri, target, lut));
    track({
      name: 'video_recorded',
      filmId: input.film.id,
      seconds: Math.round(durationMs / 1000),
    });
    return photo;
  } finally {
    if (raw.exists) raw.delete();
  }
}

/** Adds a generated moving photo (AI-14) to the album as it is. */
export async function saveAiVideo(uri: string): Promise<AlbumPhoto> {
  const { photo } = await addVideo((target) => {
    new File(uri).copySync(new File(target));
    return Promise.resolve();
  });
  return photo;
}

/** Encodes the frames of a moving photo (EDT-37) and adds it to the album as a video. */
export async function saveFramesVideo(
  frameUris: readonly string[],
  fps: number,
): Promise<AlbumPhoto> {
  const { photo } = await addVideo((target) => encodeFrames(frameUris, fps, target));
  return photo;
}
