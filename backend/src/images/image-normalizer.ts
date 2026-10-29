import { stat } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import {
  ImageStorageError,
  type ImageUploadPolicy,
} from './image-storage.port';

export interface NormalizedImage {
  readonly format: 'jpg';
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly pages: 1;
}

const MAX_CONCURRENT_NORMALIZATIONS = 1;
const MAX_QUEUED_NORMALIZATIONS = 3;
const MAX_NORMALIZATION_TIME_MS = 30_000;

const WORKER_SOURCE = String.raw`
const fs = require('node:fs/promises');
const { parentPort, workerData } = require('node:worker_threads');
const sharp = require(workerData.sharpPath);

function rejectSource(message) {
  const error = new Error(message);
  error.code = 'OBJECT_POLICY_REJECTED';
  throw error;
}

function detectSourceFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brands = [bytes.toString('ascii', 8, 12)];
    for (let offset = 16; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
      brands.push(bytes.toString('ascii', offset, offset + 4));
    }
    if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return null;
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))) return 'heif';
  }
  return null;
}

async function decodeHeif(bytes, maxPixels) {
  const heif = require(workerData.heifPath);
  const images = new heif.HeifDecoder().decode(bytes);
  if (!images.length) rejectSource('The HEIF file could not be decoded');
  const primaryImages = images.filter((image) => image.is_primary());
  const image = primaryImages.length === 1 ? primaryImages[0] : images.length === 1 ? images[0] : null;
  if (!image) rejectSource('The HEIF file does not identify one primary image');
  const width = image.get_width();
  const height = image.get_height();
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > maxPixels) {
    rejectSource('The image pixel count exceeds the upload limit');
  }
  const imageData = await new Promise((resolve, reject) => {
    const target = { data: new Uint8ClampedArray(width * height * 4), width, height };
    image.display(target, (result) => result ? resolve(result) : reject(new Error('The HEIF decoder could not render the primary image')));
  });
  return {
    input: Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    raw: { width, height, channels: 4 },
  };
}

async function normalize() {
  const bytes = await fs.readFile(workerData.sourcePath);
  if (bytes.length < 1 || bytes.length > workerData.policy.maxSourceBytes) {
    rejectSource('The source image exceeds the byte limit');
  }
  const sourceFormat = detectSourceFormat(bytes);
  if (!sourceFormat) rejectSource('The source image format is not supported');

  let input = bytes;
  let sharpOptions = { limitInputPixels: workerData.policy.maxSourcePixels, failOn: 'error' };
  if (sourceFormat === 'heif') {
    let decoded;
    try {
      decoded = await decodeHeif(bytes, workerData.policy.maxSourcePixels);
    } catch (error) {
      if (error && error.code === 'OBJECT_POLICY_REJECTED') throw error;
      rejectSource('The HEIF image could not be decoded');
    }
    input = decoded.input;
    sharpOptions = { ...sharpOptions, raw: decoded.raw };
  }

  const image = sharp(input, sharpOptions);
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    rejectSource('The source image could not be decoded');
  }
  const actualFormat = sourceFormat === 'heif' ? 'heif' : metadata.format;
  const allowedFormats = new Set(['jpeg', 'png', 'webp', 'heif']);
  const pages = metadata.pages ?? 1;
  const width = metadata.width;
  const height = metadata.height;
  if (!allowedFormats.has(actualFormat) || pages !== 1 || !width || !height || width * height > workerData.policy.maxSourcePixels) {
    rejectSource('The image content, page count, or dimensions are not allowed');
  }

  let output;
  try {
    output = await image
      .rotate()
      .resize({
        width: workerData.policy.maxEdge,
        height: workerData.policy.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColourspace('srgb')
      .jpeg({ quality: workerData.policy.quality })
      .toBuffer();
  } catch {
    rejectSource('The source image could not be normalized');
  }

  let outputMetadata;
  try {
    outputMetadata = await sharp(output).metadata();
  } catch {
    rejectSource('The normalized image could not be read');
  }
  if (outputMetadata.format !== 'jpeg' || outputMetadata.pages && outputMetadata.pages !== 1 || !outputMetadata.width || !outputMetadata.height) {
    rejectSource('The normalized output is not a single JPEG image');
  }
  await fs.writeFile(workerData.outputPath, output, { flag: 'wx', mode: 0o600 });
  parentPort.postMessage({
    ok: true,
    result: {
      format: 'jpg',
      bytes: output.length,
      width: outputMetadata.width,
      height: outputMetadata.height,
      pages: 1,
    },
  });
  parentPort.close();
}

normalize().catch((error) => {
  parentPort.postMessage({
    ok: false,
    code: error && error.code === 'OBJECT_POLICY_REJECTED' ? error.code : 'UNAVAILABLE',
    message: error instanceof Error ? error.message : 'Image normalization failed',
  });
});
`;

export class ImageNormalizer {
  private activeNormalizations = 0;
  private readonly waitingNormalizations: Array<() => void> = [];

  async normalize(
    sourcePath: string,
    outputPath: string,
    policy: ImageUploadPolicy,
  ): Promise<NormalizedImage> {
    const sourceStat = await stat(sourcePath).catch(() => null);
    if (!sourceStat || !sourceStat.isFile()) {
      throw new ImageStorageError(
        'OBJECT_NOT_FOUND',
        'The source image has not been uploaded',
      );
    }
    if (sourceStat.size < 1 || sourceStat.size > policy.maxSourceBytes) {
      throw new ImageStorageError(
        'OBJECT_POLICY_REJECTED',
        'The source image exceeds the byte limit',
      );
    }

    const release = await this.acquireSlot();
    try {
      return await this.runWorker(sourcePath, outputPath, policy);
    } finally {
      release();
    }
  }

  private async acquireSlot(): Promise<() => void> {
    if (this.activeNormalizations >= MAX_CONCURRENT_NORMALIZATIONS) {
      if (this.waitingNormalizations.length >= MAX_QUEUED_NORMALIZATIONS) {
        throw new ImageStorageError(
          'UNAVAILABLE',
          'Image processing is at its concurrency limit',
        );
      }
      await new Promise<void>((resolve) => {
        this.waitingNormalizations.push(resolve);
      });
    } else {
      this.activeNormalizations += 1;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waitingNormalizations.shift();
      if (next) next();
      else this.activeNormalizations -= 1;
    };
  }

  private runWorker(
    sourcePath: string,
    outputPath: string,
    policy: ImageUploadPolicy,
  ): Promise<NormalizedImage> {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        sourcePath,
        outputPath,
        policy,
        sharpPath: require.resolve('sharp'),
        heifPath: require.resolve('libheif-js/wasm-bundle'),
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 32,
      },
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let result: NormalizedImage | null = null;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        void worker.terminate();
        reject(
          new ImageStorageError(
            'OBJECT_POLICY_REJECTED',
            'Image normalization exceeded its processing time limit',
          ),
        );
      }, MAX_NORMALIZATION_TIME_MS);

      worker.once(
        'message',
        (message: {
          ok?: boolean;
          code?: string;
          message?: string;
          result?: NormalizedImage;
        }) => {
          if (settled) return;
          if (message.ok && message.result) {
            result = message.result;
          } else if (message.code === 'OBJECT_POLICY_REJECTED') {
            settled = true;
            clearTimeout(timeout);
            void worker.terminate();
            reject(
              new ImageStorageError(
                'OBJECT_POLICY_REJECTED',
                message.message ?? 'The image does not meet the upload policy',
              ),
            );
          } else {
            settled = true;
            clearTimeout(timeout);
            void worker.terminate();
            reject(
              new ImageStorageError(
                'UNAVAILABLE',
                'Image normalization failed',
              ),
            );
          }
        },
      );
      worker.once('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(
          new ImageStorageError(
            'UNAVAILABLE',
            'Image normalization worker failed',
          ),
        );
      });
      worker.once('exit', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0 && result) {
          resolve(result);
          return;
        }
        reject(
          new ImageStorageError(
            'UNAVAILABLE',
            result
              ? 'Image normalization worker exited unexpectedly'
              : 'Image normalization worker returned no result',
          ),
        );
      });
    });
  }
}
