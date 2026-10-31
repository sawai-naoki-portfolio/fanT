import type { Storage } from 'firebase-admin/storage';

import type { ImageStore } from '../ports';

type Bucket = ReturnType<Storage['bucket']>;

/** How long a result link works; the app downloads it right away. */
const LINK_TTL_MS = 60 * 60 * 1000;

/** Providers return JPEG or PNG images, or MP4 videos (AI-14); the app reads each. */
export function contentTypeOf(result: Uint8Array): string {
  if (result[0] === 0x89 && result[1] === 0x50 && result[2] === 0x4e && result[3] === 0x47)
    return 'image/png';
  // An MP4 starts with its 'ftyp' box.
  if (Buffer.from(result.subarray(4, 8)).toString('latin1') === 'ftyp') return 'video/mp4';
  return 'image/jpeg';
}

/** Uploads and results in Cloud Storage under `generations/<id>/`, private to the server. */
export class StorageImages implements ImageStore {
  constructor(private readonly bucket: Bucket) {}

  async putInput(id: string, jpeg: Uint8Array): Promise<void> {
    await this.bucket
      .file(`generations/${id}/input.jpg`)
      .save(Buffer.from(jpeg), { contentType: 'image/jpeg', resumable: false });
  }

  async getInput(id: string): Promise<Uint8Array> {
    const [contents] = await this.bucket.file(`generations/${id}/input.jpg`).download();
    return contents;
  }

  async putMask(id: string, png: Uint8Array): Promise<void> {
    await this.bucket
      .file(`generations/${id}/mask.png`)
      .save(Buffer.from(png), { contentType: 'image/png', resumable: false });
  }

  async getMask(id: string): Promise<Uint8Array> {
    const [contents] = await this.bucket.file(`generations/${id}/mask.png`).download();
    return contents;
  }

  async putOutput(id: string, result: Uint8Array): Promise<void> {
    await this.bucket.file(`generations/${id}/output`).save(Buffer.from(result), {
      contentType: contentTypeOf(result),
      resumable: false,
    });
  }

  async outputUrl(id: string): Promise<string> {
    const [url] = await this.bucket
      .file(`generations/${id}/output`)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + LINK_TTL_MS });
    return url;
  }

  async deleteImages(id: string): Promise<void> {
    await this.bucket.deleteFiles({ prefix: `generations/${id}/` });
  }
}
