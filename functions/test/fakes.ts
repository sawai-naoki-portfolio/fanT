import type { RateWindow } from '../src/domain/rate-limit';
import type {
  AccountRecord,
  Dependencies,
  GenerationRecord,
  ImageGenerator,
  ImageStore,
  ImageUpscaler,
  Moderator,
  Settings,
  Store,
  Transaction,
  VideoGenerator,
} from '../src/ports';

/** An in-memory store: transactions run one at a time and commit on success only. */
export class MemoryStore implements Store {
  readonly accounts = new Map<string, AccountRecord>();
  readonly generations = new Map<string, GenerationRecord>();
  readonly rates = new Map<string, RateWindow>();
  readonly events = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();

  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const run = async () => {
      const accounts = new Map(this.accounts);
      const generations = new Map(this.generations);
      const rates = new Map(this.rates);
      const events = new Set(this.events);
      const tx: Transaction = {
        getAccount: (id) => Promise.resolve(accounts.get(id) ?? null),
        setAccount: (id, account) => accounts.set(id, account),
        getGeneration: (id) => Promise.resolve(generations.get(id) ?? null),
        setGeneration: (id, generation) => generations.set(id, generation),
        getRate: (key) => Promise.resolve(rates.get(key) ?? null),
        setRate: (key, window) => rates.set(key, window),
        claimEvent: (id) => {
          if (events.has(id)) return Promise.resolve(false);
          events.add(id);
          return Promise.resolve(true);
        },
      };
      const result = await work(tx);
      this.replace(this.accounts, accounts);
      this.replace(this.generations, generations);
      this.replace(this.rates, rates);
      events.forEach((id) => this.events.add(id));
      return result;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private replace<K, V>(target: Map<K, V>, source: Map<K, V>) {
    target.clear();
    source.forEach((value, key) => target.set(key, value));
  }

  getAccount(id: string) {
    return Promise.resolve(this.accounts.get(id) ?? null);
  }

  getGeneration(id: string) {
    return Promise.resolve(this.generations.get(id) ?? null);
  }

  listGenerationsBefore(time: number, limit: number) {
    return Promise.resolve(
      [...this.generations.entries()]
        .filter(([, g]) => g.createdAt < time)
        .slice(0, limit)
        .map(([id]) => id),
    );
  }

  deleteGeneration(id: string) {
    this.generations.delete(id);
    return Promise.resolve();
  }
}

export class MemoryImages implements ImageStore {
  readonly inputs = new Map<string, Uint8Array>();
  readonly outputs = new Map<string, Uint8Array>();
  readonly masks = new Map<string, Uint8Array>();

  putMask(id: string, png: Uint8Array) {
    this.masks.set(id, png);
    return Promise.resolve();
  }

  getMask(id: string) {
    const mask = this.masks.get(id);
    return mask === undefined ? Promise.reject(new Error('missing mask')) : Promise.resolve(mask);
  }

  putInput(id: string, jpeg: Uint8Array) {
    this.inputs.set(id, jpeg);
    return Promise.resolve();
  }

  getInput(id: string) {
    const input = this.inputs.get(id);
    return input === undefined
      ? Promise.reject(new Error('missing input'))
      : Promise.resolve(input);
  }

  putOutput(id: string, image: Uint8Array) {
    this.outputs.set(id, image);
    return Promise.resolve();
  }

  outputUrl(id: string) {
    return Promise.resolve(`https://storage.example.com/${id}.jpg`);
  }

  deleteImages(id: string) {
    this.inputs.delete(id);
    this.outputs.delete(id);
    this.masks.delete(id);
    return Promise.resolve();
  }
}

export const TEST_SETTINGS: Settings = {
  monthlyCredits: 10,
  generationsPerHour: 3,
  accountsPerAddressPerDay: 2,
  eventBatchesPerAddressPerHour: 2,
  generationTimeoutMs: 50,
  videoTimeoutMs: 50,
};

export function testDependencies(
  overrides: {
    generator?: ImageGenerator;
    upscaler?: ImageUpscaler;
    videoGenerator?: VideoGenerator;
    moderator?: Moderator;
    now?: () => number;
  } = {},
) {
  const store = new MemoryStore();
  const images = new MemoryImages();
  const logs: { level: string; message: string; fields?: Record<string, unknown> }[] = [];
  const deps: Dependencies = {
    store,
    images,
    generator: overrides.generator ?? { generate: (image) => Promise.resolve(image) },
    upscaler: overrides.upscaler ?? { upscale: (image) => Promise.resolve(image) },
    videoGenerator: overrides.videoGenerator ?? {
      animate: () => Promise.reject(new Error('no video in this test')),
    },
    moderator: overrides.moderator ?? { isAllowed: () => Promise.resolve(true) },
    logger: {
      info: (message, fields) => logs.push({ level: 'info', message, fields }),
      warn: (message, fields) => logs.push({ level: 'warn', message, fields }),
      error: (message, fields) => logs.push({ level: 'error', message, fields }),
    },
    settings: TEST_SETTINGS,
    now: overrides.now ?? (() => Date.parse('2026-11-15T00:00:00Z')),
  };
  return { deps, store, images, logs };
}

/** A tiny valid-looking JPEG (magic bytes) as base64. */
export const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 1, 2, 3]).toString(
  'base64',
);
/** A PNG signature and a byte: enough for the mask checks. */
export const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString(
  'base64',
);
export const SECRET = 'S'.repeat(43);
