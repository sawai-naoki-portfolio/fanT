import { BUNDLED_ASSETS } from '@fant/content/bundled-assets';
import type { AssetRef } from '@fant/content-schema';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { APP_CONFIG } from '../../config';
import { downloadFile } from '../../lib/download-file';

/** Downloaded assets, named by content hash: immutable and shared between items. */
const CACHE = new Directory(Paths.cache, 'content-assets');

/** Stamps and character parts are small images; anything larger is not ours. */
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

class AssetUnavailableError extends Error {
  override readonly name = 'AssetUnavailableError';
}

const pending = new Map<string, Promise<string>>();

async function download(ref: AssetRef): Promise<string> {
  const { contentBaseUrl } = APP_CONFIG;
  if (contentBaseUrl === null) throw new AssetUnavailableError(`No content server for ${ref.path}`);
  const extension = ref.path.slice(ref.path.lastIndexOf('.'));
  const target = new File(CACHE, `${ref.sha256}${extension}`);
  if (target.exists) return target.uri;

  CACHE.create({ intermediates: true, idempotent: true });
  const partial = new File(CACHE, `${ref.sha256}.partial`);
  await downloadFile(`${contentBaseUrl}/${ref.path}`, partial, {
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    maxBytes: MAX_ASSET_BYTES,
  });
  // A corrupted or tampered download is discarded, never used (CNT-02).
  if ((await partial.digest('SHA-256')) !== ref.sha256) {
    partial.delete();
    throw new AssetUnavailableError(`Hash mismatch for ${ref.path}`);
  }
  partial.moveSync(target);
  return target.uri;
}

/**
 * A local file URI for a content asset: bundled assets work offline (CNT-05),
 * others are downloaded on first use and cached (CNT-02).
 */
export async function resolveAsset(ref: AssetRef): Promise<string> {
  const bundled = BUNDLED_ASSETS[ref.path];
  if (bundled !== undefined) {
    const asset = await Asset.fromModule(bundled).downloadAsync();
    if (asset.localUri === null)
      throw new AssetUnavailableError(`Bundled asset missing: ${ref.path}`);
    return asset.localUri;
  }
  let request = pending.get(ref.sha256);
  if (request === undefined) {
    request = download(ref).finally(() => pending.delete(ref.sha256));
    pending.set(ref.sha256, request);
  }
  return request;
}
