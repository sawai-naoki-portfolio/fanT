import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { FirestoreStore } from './adapters/firestore-store';
import { GeminiImageGenerator } from './adapters/google/gemini-image-generator';
import { metadataTokenSource } from './adapters/google/http';
import { ImagenUpscaler } from './adapters/google/imagen-upscaler';
import { SafeSearchModerator } from './adapters/google/safe-search-moderator';
import { VeoVideoGenerator } from './adapters/google/veo-video-generator';
import {
  allowAllModerator,
  echoGenerator,
  echoUpscaler,
  noVideoGenerator,
} from './adapters/mock-provider';
import { StorageImages } from './adapters/storage-images';
import { handleRequest } from './http/api';
import { clientAddress } from './http/client-address';
import type {
  Dependencies,
  ImageGenerator,
  ImageUpscaler,
  Moderator,
  VideoGenerator,
} from './ports';
import { deleteExpiredGenerations, processGeneration } from './services/generations';

initializeApp();

const REGION = 'asia-northeast1';
/**
 * Which image generation provider to use (Q-04): `google` (Gemini on Vertex AI with
 * Cloud Vision moderation) or `mock` for the emulator and staging.
 */
const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'mock' });
/** The Vertex AI image model for `google`. */
const AI_MODEL = defineString('AI_MODEL', { default: 'gemini-2.5-flash-image' });
/** The Vertex AI upscaling model for `google` (AI-11). */
const AI_UPSCALE_MODEL = defineString('AI_UPSCALE_MODEL', { default: 'imagegeneration@002' });
/** The Vertex AI image-to-video model for `google` (AI-14). */
const AI_VIDEO_MODEL = defineString('AI_VIDEO_MODEL', { default: 'veo-3.0-fast-generate-001' });
/** How long a video generation may take; Veo takes one to three minutes. */
const VIDEO_TIMEOUT_MS = 240_000;
const MONTHLY_CREDITS = defineInt('MONTHLY_CREDITS', { default: 10 });
const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

function provider(): {
  generator: ImageGenerator;
  upscaler: ImageUpscaler;
  videoGenerator: VideoGenerator;
  moderator: Moderator;
} {
  const name = AI_PROVIDER.value();
  if (name === 'mock') {
    // The echo provider must never serve real users.
    if (process.env.GCLOUD_PROJECT?.endsWith('-prod') === true) {
      throw new Error('AI_PROVIDER=mock is not allowed in production');
    }
    return {
      generator: echoGenerator,
      upscaler: echoUpscaler,
      videoGenerator: noVideoGenerator,
      moderator: allowAllModerator,
    };
  }
  if (name === 'google') {
    const project = process.env.GCLOUD_PROJECT;
    if (project === undefined) throw new Error('GCLOUD_PROJECT is not set');
    const token = metadataTokenSource();
    return {
      generator: new GeminiImageGenerator({ project, model: AI_MODEL.value(), token }),
      upscaler: new ImagenUpscaler({ project, model: AI_UPSCALE_MODEL.value(), token }),
      videoGenerator: new VeoVideoGenerator({ project, model: AI_VIDEO_MODEL.value(), token }),
      moderator: new SafeSearchModerator({ token }),
    };
  }
  throw new Error(`Unknown AI_PROVIDER "${name}"`);
}

let dependencies: Dependencies | undefined;

/** Built on first use so deploy-time analysis does not need credentials. */
function deps(): Dependencies {
  dependencies ??= {
    store: new FirestoreStore(getFirestore()),
    images: new StorageImages(getStorage().bucket()),
    ...provider(),
    logger: {
      info: (message, fields) => {
        logger.info(message, fields);
      },
      warn: (message, fields) => {
        logger.warn(message, fields);
      },
      error: (message, fields) => {
        logger.error(message, fields);
      },
    },
    settings: {
      monthlyCredits: MONTHLY_CREDITS.value(),
      generationsPerHour: 10,
      accountsPerAddressPerDay: 5,
      eventBatchesPerAddressPerHour: 1000,
      generationTimeoutMs: 60_000,
      videoTimeoutMs: VIDEO_TIMEOUT_MS,
    },
    now: () => Date.now(),
  };
  return dependencies;
}

/** The app's API (07 §2). App Check is enforced when configured (03 §5). */
export const api = onRequest(
  {
    region: REGION,
    secrets: [REVENUECAT_WEBHOOK_SECRET],
    // Uploads are at most 3 MB (base64 grows them by a third).
    memory: '512MiB',
    timeoutSeconds: 30,
    maxInstances: 20,
    cors: false,
  },
  async (request, response) => {
    const result = await handleRequest(
      deps(),
      { revenueCatWebhookSecret: REVENUECAT_WEBHOOK_SECRET.value() },
      {
        method: request.method,
        path: request.path,
        headers: { authorization: request.header('authorization') },
        body: request.body as unknown,
        address: clientAddress(request.header('x-forwarded-for'), request.ip),
      },
    );
    response.status(result.status);
    if (result.body === undefined) response.end();
    else response.json(result.body);
  },
);

/** Runs each generation when it is queued, with time for the longest (video) provider call. */
export const runGeneration = onDocumentCreated(
  {
    document: 'generations/{id}',
    region: REGION,
    timeoutSeconds: VIDEO_TIMEOUT_MS / 1000 + 60,
    memory: '1GiB',
    retry: false,
  },
  async (event) => {
    await processGeneration(deps(), event.params.id);
  },
);

/** Deletes uploads, results and jobs older than 24 hours (03 §6). */
export const deleteExpired = onSchedule(
  { schedule: 'every 1 hours', region: REGION, timeoutSeconds: 540 },
  async () => {
    const deleted = await deleteExpiredGenerations(deps());
    logger.info('generations.deleted', { deleted });
  },
);
