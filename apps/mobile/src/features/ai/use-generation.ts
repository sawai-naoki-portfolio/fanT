import { isVideoTool, UPLOAD_LONG_EDGE } from '@fant/api-types';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

import { resizeJpeg } from '../../engine/photo';
import { downloadFile } from '../../lib/download-file';
import { sleep } from '../../lib/sleep';
import { tempDirectory } from '../../lib/temp-files';
import { reportError, track } from '../analytics/analytics';
import { cancelGeneration, getGeneration, startGeneration } from './ai-client';
import { useAi } from './ai-store';
import { GenerationRun, type GenerationState } from './generation-run';

export type { GenerationState } from './generation-run';

/** How results are fetched: an image of a few megabytes, or a video of a few seconds (AI-14). */
const RESULTS = {
  image: { extension: 'jpg', maxBytes: 15 * 1024 * 1024, downloadMs: 30_000, giveUpMs: 120_000 },
  // The server allows a video four minutes and refunds after that.
  video: { extension: 'mp4', maxBytes: 60 * 1024 * 1024, downloadMs: 90_000, giveUpMs: 300_000 },
} as const;

/**
 * Runs one generation (S-43): uploads a downscaled copy (nothing larger leaves the
 * device) and, for erasing, the mask, polls until it ends, then downloads the result.
 * Cancelling refunds the credit on the server.
 */
export function useGeneration(sourceUri: string, styleId: string, maskUri: string | null) {
  const [state, setState] = useState<GenerationState>({ phase: 'running', id: null });
  const current = useRef<{ key: string; run: GenerationRun } | null>(null);

  useEffect(() => {
    // Start once per photo and style: a remount (e.g. React strict mode) must not
    // start, and pay for, a second generation.
    const key = `${styleId}|${sourceUri}|${maskUri ?? ''}`;
    if (current.current?.key === key) {
      const { run } = current.current;
      run.attach();
      return () => {
        run.detach();
      };
    }
    const result = RESULTS[isVideoTool(styleId) ? 'video' : 'image'];
    const run = new GenerationRun(
      {
        start: () => {
          const upload = resizeJpeg(new File(sourceUri).bytesSync(), UPLOAD_LONG_EDGE);
          const mask = maskUri === null ? undefined : new File(maskUri).bytesSync();
          return startGeneration(styleId, upload, mask);
        },
        get: getGeneration,
        cancel: cancelGeneration,
        download: async (id, url) => {
          const file = new File(tempDirectory('ai'), `${id}.${result.extension}`);
          await downloadFile(url, file, {
            timeoutMs: result.downloadMs,
            maxBytes: result.maxBytes,
          });
          return file.uri;
        },
        setCredits: (credits) => {
          useAi.getState().setCredits(credits);
        },
        onSucceeded: () => {
          track({ name: 'ai_generated', styleId });
        },
        reportError,
        sleep,
        now: Date.now,
        giveUpMs: result.giveUpMs,
      },
      setState,
    );
    current.current = { key, run };
    void run.run();
    return () => {
      run.detach();
    };
  }, [sourceUri, styleId, maskUri]);

  const cancel = () => current.current?.run.cancel() ?? Promise.resolve();

  return { state, cancel };
}
