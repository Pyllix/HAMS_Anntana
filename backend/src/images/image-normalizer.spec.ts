import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ImageNormalizer } from './image-normalizer';
import { imageUploadPolicy } from './image-upload-policy';

const fixtureDirectory = join(
  __dirname,
  '../../test/fixtures/cloudinary-contract',
);

interface HeifDecodedImage {
  get_width(): number;
  get_height(): number;
  is_primary(): boolean;
  display(
    target: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
    },
    callback: (image: { data: Uint8ClampedArray } | null) => void,
  ): void;
}

interface HeifDecoderModule {
  HeifDecoder: new () => { decode(source: Buffer): HeifDecodedImage[] };
}

const heif = createRequire(__filename)(
  'libheif-js/wasm-bundle',
) as HeifDecoderModule;

describe('ImageNormalizer', () => {
  let outputDirectory: string;
  let normalizer: ImageNormalizer;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'hams-image-normalizer-'));
    normalizer = new ImageNormalizer();
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it.each([
    'jpeg.jpg',
    'transparent.png',
    'static.webp',
    'portrait.heic',
    'portrait.heif',
  ])(
    'normalizes the real %s fixture to metadata-free JPEG',
    async (name) => {
      const sourcePath = join(fixtureDirectory, name);
      const outputPath = join(outputDirectory, `${name}.jpg`);

      const result = await normalizer.normalize(
        sourcePath,
        outputPath,
        imageUploadPolicy('ASSET_IMAGE'),
      );

      const output = await readFile(outputPath);
      const metadata = await sharp(output).metadata();
      expect(result.format).toBe('jpg');
      expect(result.pages).toBe(1);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.width).toBe(result.width);
      expect(metadata.height).toBe(result.height);
      expect(metadata.hasAlpha).toBe(false);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.iptc).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1600);
    },
    30_000,
  );

  it.each(['portrait.heic', 'portrait.heif'])(
    'normalizes the primary image and preserves HEIF colors from %s',
    async (name) => {
      const source = await readFile(join(fixtureDirectory, name));
      const decodedImages = new heif.HeifDecoder().decode(source);
      const primaryImages = decodedImages.filter((image) => image.is_primary());
      expect(primaryImages).toHaveLength(1);
      const primaryImage = primaryImages[0];
      const width = primaryImage.get_width();
      const height = primaryImage.get_height();
      const decodedPixels = await new Promise<Uint8ClampedArray>(
        (resolve, reject) => {
          primaryImage.display(
            {
              data: new Uint8ClampedArray(width * height * 4),
              width,
              height,
            },
            (image) => {
              if (image) resolve(image.data);
              else reject(new Error('The HEIF fixture could not be decoded'));
            },
          );
        },
      );
      const expected = await sharp(Buffer.from(decodedPixels), {
        raw: { width, height, channels: 4 },
      })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });
      const outputPath = join(outputDirectory, `${name}.normalized.jpg`);
      await normalizer.normalize(
        join(fixtureDirectory, name),
        outputPath,
        imageUploadPolicy('ASSET_IMAGE'),
      );
      const actual = await sharp(outputPath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      expect(actual.info.width).toBe(expected.info.width);
      expect(actual.info.height).toBe(expected.info.height);
      expect(actual.info.channels).toBe(3);
      let totalDifference = 0;
      for (let index = 0; index < expected.data.length; index += 1) {
        totalDifference += Math.abs(expected.data[index] - actual.data[index]);
      }
      expect(totalDifference / expected.data.length).toBeLessThan(10);
    },
    30_000,
  );

  it('applies EXIF rotation and does not enlarge a small image', async () => {
    const rotatedPath = join(outputDirectory, 'rotated.jpg');
    const smallPath = join(outputDirectory, 'small.jpg');

    const rotated = await normalizer.normalize(
      join(fixtureDirectory, 'rotated.jpg'),
      rotatedPath,
      imageUploadPolicy('ASSET_IMAGE'),
    );
    const small = await normalizer.normalize(
      join(fixtureDirectory, 'small.jpg'),
      smallPath,
      imageUploadPolicy('ASSET_IMAGE'),
    );

    expect(rotated.width).toBe(480);
    expect(rotated.height).toBe(640);
    expect(Math.max(small.width, small.height)).toBe(800);
  });

  it('applies mirrored orientation, composites transparency onto white, and normalizes color profiles', async () => {
    for (const name of [
      'mirrored.jpg',
      'semi-transparent.png',
      'color-profile.jpg',
    ]) {
      const source = await readFile(join(fixtureDirectory, name));
      const outputPath = join(outputDirectory, `${name}.normalized.jpg`);
      await normalizer.normalize(
        join(fixtureDirectory, name),
        outputPath,
        imageUploadPolicy('ASSET_IMAGE'),
      );

      const sourcePixels = await sharp(source)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });
      const outputPixels = await sharp(outputPath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      expect(outputPixels.info.width).toBe(sourcePixels.info.width);
      expect(outputPixels.info.height).toBe(sourcePixels.info.height);
      expect(outputPixels.info.channels).toBe(3);
      let totalDifference = 0;
      for (let index = 0; index < sourcePixels.data.length; index += 1) {
        totalDifference += Math.abs(
          sourcePixels.data[index] - outputPixels.data[index],
        );
      }
      expect(totalDifference / sourcePixels.data.length).toBeLessThan(10);
    }
  });

  it('loads the bundled HEIF decoder independently of the application working directory', async () => {
    const originalWorkingDirectory = process.cwd();
    const outputPath = join(outputDirectory, 'cwd-independent.jpg');
    try {
      process.chdir(outputDirectory);
      const result = await normalizer.normalize(
        join(fixtureDirectory, 'portrait.heic'),
        outputPath,
        imageUploadPolicy('ASSET_IMAGE'),
      );
      expect(result.format).toBe('jpg');
      expect(result.pages).toBe(1);
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  }, 30_000);

  it.each([
    'animated.webp',
    'corrupt.jpg',
    'large-pixel.png',
    'oversized.jpg',
    'unsupported.gif',
  ])('rejects invalid or over-budget source %s', async (name) => {
    await expect(
      normalizer.normalize(
        join(fixtureDirectory, name),
        join(outputDirectory, `${name}.jpg`),
        imageUploadPolicy('ASSET_IMAGE'),
      ),
    ).rejects.toThrow();
  });
});
