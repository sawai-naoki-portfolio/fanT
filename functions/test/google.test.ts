import { describe, expect, it } from 'vitest';

import { GeminiImageGenerator } from '../src/adapters/google/gemini-image-generator';
import { metadataTokenSource, type Fetch } from '../src/adapters/google/http';
import { ImagenUpscaler } from '../src/adapters/google/imagen-upscaler';
import { SafeSearchModerator } from '../src/adapters/google/safe-search-moderator';
import { ContentBlockedError } from '../src/ports';

const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const signal = new AbortController().signal;
const token = () => Promise.resolve('token');

/** A fetch that answers every call with `body` and records the requests. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: Fetch = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { fn, calls };
}

describe('GeminiImageGenerator', () => {
  const generator = (body: unknown, status?: number) => {
    const fetch = fakeFetch(body, status);
    return {
      calls: fetch.calls,
      generator: new GeminiImageGenerator({ project: 'p', model: 'm', token, fetch: fetch.fn }),
    };
  };

  it('sends the photo and prompt and returns the generated image', async () => {
    const output = Buffer.from('png').toString('base64');
    const { generator: g, calls } = generator({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: 'image/png', data: output } }] } },
      ],
    });
    expect(Buffer.from(await g.generate(IMAGE, 'make it cute', signal)).toString()).toBe('png');
    expect(calls[0]?.url).toBe(
      'https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent',
    );
    const sent = JSON.parse(calls[0]?.init.body as string) as {
      contents: { parts: { text?: string }[] }[];
    };
    expect(sent.contents[0]?.parts[1]?.text).toBe('make it cute');
  });

  it('reports safety refusals as blocked', async () => {
    await expect(
      generator({ promptFeedback: { blockReason: 'SAFETY' } }).generator.generate(
        IMAGE,
        'x',
        signal,
      ),
    ).rejects.toBeInstanceOf(ContentBlockedError);
    await expect(
      generator({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }).generator.generate(
        IMAGE,
        'x',
        signal,
      ),
    ).rejects.toBeInstanceOf(ContentBlockedError);
  });

  it('fails on errors and responses without an image', async () => {
    await expect(generator({}, 500).generator.generate(IMAGE, 'x', signal)).rejects.toThrow(
      'HTTP 500',
    );
    await expect(
      generator({ candidates: [{ finishReason: 'STOP' }] }).generator.generate(IMAGE, 'x', signal),
    ).rejects.not.toBeInstanceOf(ContentBlockedError);
  });
});

describe('GeminiImageGenerator with a mask', () => {
  it('sends the mask as a second image before the prompt', async () => {
    const fetch = fakeFetch({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'cG5n' } }] } },
      ],
    });
    const g = new GeminiImageGenerator({ project: 'p', model: 'm', token, fetch: fetch.fn });
    await g.generate(IMAGE, 'erase', signal, new Uint8Array([1, 2]));
    const sent = JSON.parse(fetch.calls[0]?.init.body as string) as {
      contents: { parts: { text?: string; inlineData?: { mimeType: string } }[] }[];
    };
    const parts = sent.contents[0]?.parts ?? [];
    expect(parts.map((part) => part.inlineData?.mimeType ?? part.text)).toEqual([
      'image/jpeg',
      'image/png',
      'erase',
    ]);
  });
});

describe('ImagenUpscaler', () => {
  it('asks for a 2x upscale and returns the image', async () => {
    const fetch = fakeFetch({ predictions: [{ bytesBase64Encoded: 'anBn' }] });
    const upscaler = new ImagenUpscaler({ project: 'p', model: 'm', token, fetch: fetch.fn });
    expect(Buffer.from(await upscaler.upscale(IMAGE, signal)).toString()).toBe('jpg');
    expect(fetch.calls[0]?.url).toContain('/models/m:predict');
    expect(JSON.parse(fetch.calls[0]?.init.body as string)).toMatchObject({
      parameters: { mode: 'upscale', upscaleConfig: { upscaleFactor: 'x2' } },
    });
  });

  it('fails without an image', async () => {
    const fetch = fakeFetch({ predictions: [] });
    const upscaler = new ImagenUpscaler({ project: 'p', model: 'm', token, fetch: fetch.fn });
    await expect(upscaler.upscale(IMAGE, signal)).rejects.toThrow();
  });
});

describe('SafeSearchModerator', () => {
  const moderate = (annotation: Record<string, string>) =>
    new SafeSearchModerator({
      token,
      fetch: fakeFetch({ responses: [{ safeSearchAnnotation: annotation }] }).fn,
    }).isAllowed(IMAGE, signal);

  it('allows images unlikely to be adult, racy or violent', async () => {
    expect(await moderate({ adult: 'VERY_UNLIKELY', violence: 'UNLIKELY', racy: 'POSSIBLE' })).toBe(
      true,
    );
  });

  it('refuses likely adult, racy or violent images', async () => {
    expect(await moderate({ adult: 'LIKELY', violence: 'VERY_UNLIKELY', racy: 'UNLIKELY' })).toBe(
      false,
    );
    expect(await moderate({ adult: 'UNLIKELY', violence: 'UNLIKELY', racy: 'VERY_LIKELY' })).toBe(
      false,
    );
  });

  it('fails rather than allowing an image it could not judge', async () => {
    const moderator = new SafeSearchModerator({
      token,
      fetch: fakeFetch({ responses: [{ error: { message: 'bad image' } }] }).fn,
    });
    await expect(moderator.isAllowed(IMAGE, signal)).rejects.toThrow('bad image');
  });
});

describe('metadataTokenSource', () => {
  it('caches the token until it is about to expire', async () => {
    const fetch = fakeFetch({ access_token: 'abc', expires_in: 3600 });
    const source = metadataTokenSource(fetch.fn);
    expect(await source(signal)).toBe('abc');
    expect(await source(signal)).toBe('abc');
    expect(fetch.calls).toHaveLength(1);
    expect(new Headers(fetch.calls[0]?.init.headers).get('Metadata-Flavor')).toBe('Google');
  });
});
