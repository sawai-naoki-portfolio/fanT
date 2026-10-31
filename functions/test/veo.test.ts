import { describe, expect, it } from 'vitest';

import type { Fetch } from '../src/adapters/google/http';
import { VeoVideoGenerator } from '../src/adapters/google/veo-video-generator';
import { ContentBlockedError } from '../src/ports';

const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const MP4 = Buffer.from('....ftypisom').toString('base64');
const signal = new AbortController().signal;

/** Answers the start call, then each poll in turn; records every request. */
function veo(polls: unknown[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchFn: Fetch = (url, init) => {
    calls.push({ url, body: JSON.parse(init.body as string) as unknown });
    const body = url.endsWith(':predictLongRunning') ? { name: 'operations/op1' } : polls.shift();
    return Promise.resolve(Response.json(body));
  };
  const generator = new VeoVideoGenerator({
    project: 'fant-staging',
    model: 'veo-test',
    token: () => Promise.resolve('token'),
    fetch: fetchFn,
    wait: () => Promise.resolve(),
  });
  return { generator, calls };
}

describe('VeoVideoGenerator', () => {
  it('starts a prediction, polls until done and returns the video', async () => {
    const { generator, calls } = veo([
      { done: false },
      { done: true, response: { videos: [{ bytesBase64Encoded: MP4, mimeType: 'video/mp4' }] } },
    ]);

    const video = await generator.animate(IMAGE, 'move', 'portrait', signal);

    expect(Buffer.from(video).toString('base64')).toBe(MP4);
    expect(calls.map(({ url }) => url.split(':').at(-1))).toEqual([
      'predictLongRunning',
      'fetchPredictOperation',
      'fetchPredictOperation',
    ]);
    expect(calls[0]?.url).toContain('/projects/fant-staging/locations/us-central1/');
    expect(calls[0]?.body).toMatchObject({
      instances: [{ prompt: 'move', image: { mimeType: 'image/jpeg' } }],
      parameters: { sampleCount: 1, aspectRatio: '9:16', generateAudio: false },
    });
    expect(calls[1]?.body).toEqual({ operationName: 'operations/op1' });
  });

  it('asks for a landscape video for a landscape photo', async () => {
    const { generator, calls } = veo([
      { done: true, response: { videos: [{ bytesBase64Encoded: MP4 }] } },
    ]);
    await generator.animate(IMAGE, 'move', 'landscape', signal);
    expect(calls[0]?.body).toMatchObject({ parameters: { aspectRatio: '16:9' } });
  });

  it('reports filtered videos as blocked, and other failures as errors', async () => {
    const blocked = veo([
      { done: true, response: { raiMediaFilteredCount: 1, raiMediaFilteredReasons: ['x'] } },
    ]);
    await expect(blocked.generator.animate(IMAGE, 'm', 'portrait', signal)).rejects.toBeInstanceOf(
      ContentBlockedError,
    );
    const failed = veo([{ done: true, error: { message: 'quota' } }]);
    await expect(failed.generator.animate(IMAGE, 'm', 'portrait', signal)).rejects.toThrow('quota');
    const empty = veo([{ done: true, response: {} }]);
    await expect(empty.generator.animate(IMAGE, 'm', 'portrait', signal)).rejects.toThrow(
      'No video',
    );
  });

  it('stops polling when the job times out', async () => {
    const controller = new AbortController();
    const generator = new VeoVideoGenerator({
      project: 'p',
      model: 'm',
      token: () => Promise.resolve('token'),
      fetch: () => Promise.resolve(Response.json({ name: 'operations/op1' })),
    });
    const running = generator.animate(IMAGE, 'm', 'portrait', controller.signal);
    controller.abort(new DOMException('Timed out', 'AbortError'));
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  });
});
