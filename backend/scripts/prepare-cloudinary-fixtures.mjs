import { randomFillSync } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const MAX_SOURCE_BYTES = 10_000_000;
const MAX_SOURCE_PIXELS = 25_000_000;
const outputDirectory = resolve(
  process.cwd(),
  getOption('--dir') ??
    process.env.CLOUDINARY_CONTRACT_FIXTURE_DIR ??
    'test/fixtures/cloudinary-contract',
);
const force = process.argv.includes('--force');

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function syntheticSvg(
  width,
  height,
  { transparent = false, variant = 0 } = {},
) {
  const first = ['#d9485f', '#f2b134', '#177e89'][variant % 3];
  const second = ['#2d3047', '#2b2d42', '#f45b69'][variant % 3];
  const third = ['#f2b134', '#8d99ae', '#3a506b'][variant % 3];
  const base = transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="#eeeeee"/>`;
  const alpha = transparent ? ' opacity="0.55"' : '';

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${base}
      <rect x="0" y="0" width="${Math.floor(width * 0.58)}" height="${Math.floor(height * 0.46)}" fill="${first}"${alpha}/>
      <rect x="${Math.floor(width * 0.58)}" y="0" width="${Math.ceil(width * 0.42)}" height="${Math.floor(height * 0.7)}" fill="${second}"${alpha}/>
      <path d="M0 ${Math.floor(height * 0.46)} L${Math.floor(width * 0.58)} ${Math.floor(height * 0.46)} L${Math.floor(width * 0.36)} ${height} L0 ${height} Z" fill="${third}"${alpha}/>
      <circle cx="${Math.floor(width * 0.77)}" cy="${Math.floor(height * 0.8)}" r="${Math.max(8, Math.floor(Math.min(width, height) * 0.12))}" fill="#24a148"${alpha}/>
    </svg>`,
  );
}

async function writeFixture(name, makeBuffer) {
  const filePath = join(outputDirectory, name);
  if (!force) {
    try {
      await access(filePath);
      console.log(`Keeping existing ${name} (use --force to regenerate)`);
      return;
    } catch {
      // Missing files are generated below.
    }
  }

  const bytes = await makeBuffer();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  console.log(`Created ${name} (${bytes.length.toLocaleString()} bytes)`);
}

function assertHeifContainer(bytes, name) {
  if (bytes.toString('ascii', 4, 8) !== 'ftyp') {
    throw new Error(`${name} does not have an ISO-BMFF ftyp header`);
  }
  const boxSize = bytes.readUInt32BE(0);
  if (boxSize < 16 || boxSize > bytes.length) {
    throw new Error(`${name} has an invalid ftyp box size`);
  }
}

async function downloadFixture(name, url) {
  const filePath = join(outputDirectory, name);
  if (!force) {
    try {
      await access(filePath);
      console.log(`Keeping existing ${name} (use --force to download again)`);
      return;
    } catch {
      // Missing files are downloaded below.
    }
  }

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Could not download ${name}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 5_000_000) {
    throw new Error(
      `Unexpected download size for ${name}: ${bytes.length} bytes`,
    );
  }
  assertHeifContainer(bytes, name);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'heif' || metadata.pages !== 1) {
    throw new Error(`${name} is not a valid still HEIF image`);
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  console.log(`Downloaded ${name} (${bytes.length.toLocaleString()} bytes)`);
}

function webpChunks(bytes) {
  if (
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Sharp did not return a WebP frame');
  }

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length) throw new Error('Invalid WebP frame chunk');
    const name = bytes.toString('ascii', offset, offset + 4);
    if (name === 'VP8 ' || name === 'VP8L' || name === 'ALPH') {
      chunks.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (chunks.length === 0) throw new Error('WebP frame has no image payload');
  return Buffer.concat(chunks);
}

function riffChunk(name, data) {
  const header = Buffer.alloc(8);
  header.write(name, 0, 4, 'ascii');
  header.writeUInt32LE(data.length, 4);
  return data.length % 2
    ? Buffer.concat([header, data, Buffer.from([0])])
    : Buffer.concat([header, data]);
}

function writeUInt24LE(buffer, value, offset) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
}

async function makeAnimatedWebp() {
  const width = 96;
  const height = 72;
  const frames = [];
  for (const variant of [0, 1]) {
    const encodedFrame = await sharp(syntheticSvg(width, height, { variant }))
      .webp({ lossless: true })
      .toBuffer();
    const frameHeader = Buffer.alloc(16);
    writeUInt24LE(frameHeader, 0, 0); // X offset in units of two pixels.
    writeUInt24LE(frameHeader, 0, 3); // Y offset in units of two pixels.
    writeUInt24LE(frameHeader, width - 1, 6);
    writeUInt24LE(frameHeader, height - 1, 9);
    writeUInt24LE(frameHeader, 120, 12); // Frame duration in milliseconds.
    frameHeader[15] = 0;
    frames.push(
      riffChunk('ANMF', Buffer.concat([frameHeader, webpChunks(encodedFrame)])),
    );
  }

  const extendedHeader = Buffer.alloc(10);
  extendedHeader[0] = 0x02; // Animation flag; all other VP8X flags are unset.
  writeUInt24LE(extendedHeader, width - 1, 4);
  writeUInt24LE(extendedHeader, height - 1, 7);
  const animationControl = Buffer.alloc(6); // Transparent black background, infinite loop.
  const chunks = [
    riffChunk('VP8X', extendedHeader),
    riffChunk('ANIM', animationControl),
    ...frames,
  ];
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 4, 'ascii');
  return Buffer.concat([header, body]);
}

function createExifGpsJpeg(jpeg) {
  const make = Buffer.from('Synthetic Test Camera\0', 'ascii');
  const model = Buffer.from('Fixture Generator\0', 'ascii');
  const ifd0Offset = 8;
  const ifd0Length = 2 + 3 * 12 + 4;
  const makeOffset = ifd0Offset + ifd0Length;
  const modelOffset = makeOffset + make.length;
  const gpsOffset = modelOffset + model.length;
  const gpsLength = 2 + 5 * 12 + 4;
  const coordinatesOffset = gpsOffset + gpsLength;
  const tiff = Buffer.alloc(coordinatesOffset + 6 * 8);

  tiff.write('II', 0, 2, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifd0Offset, 4);

  function writeEntry(offset, { tag, type, count, value, data }) {
    tiff.writeUInt16LE(tag, offset);
    tiff.writeUInt16LE(type, offset + 2);
    tiff.writeUInt32LE(count, offset + 4);
    if (data) {
      if (data.length <= 4) data.copy(tiff, offset + 8);
      else tiff.writeUInt32LE(value, offset + 8);
    } else {
      tiff.writeUInt32LE(value, offset + 8);
    }
  }

  tiff.writeUInt16LE(3, ifd0Offset);
  writeEntry(ifd0Offset + 2, {
    tag: 0x010f,
    type: 2,
    count: make.length,
    value: makeOffset,
  });
  writeEntry(ifd0Offset + 14, {
    tag: 0x0110,
    type: 2,
    count: model.length,
    value: modelOffset,
  });
  writeEntry(ifd0Offset + 26, {
    tag: 0x8825,
    type: 4,
    count: 1,
    value: gpsOffset,
  });
  tiff.writeUInt32LE(0, ifd0Offset + 38);
  make.copy(tiff, makeOffset);
  model.copy(tiff, modelOffset);

  tiff.writeUInt16LE(5, gpsOffset);
  writeEntry(gpsOffset + 2, {
    tag: 0,
    type: 1,
    count: 4,
    data: Buffer.from([2, 3, 0, 0]),
  });
  writeEntry(gpsOffset + 14, {
    tag: 1,
    type: 2,
    count: 2,
    data: Buffer.from('N\0', 'ascii'),
  });
  writeEntry(gpsOffset + 26, {
    tag: 2,
    type: 5,
    count: 3,
    value: coordinatesOffset,
  });
  writeEntry(gpsOffset + 38, {
    tag: 3,
    type: 2,
    count: 2,
    data: Buffer.from('E\0', 'ascii'),
  });
  writeEntry(gpsOffset + 50, {
    tag: 4,
    type: 5,
    count: 3,
    value: coordinatesOffset + 24,
  });
  tiff.writeUInt32LE(0, gpsOffset + 62);
  for (let index = 0; index < 6; index += 1) {
    tiff.writeUInt32LE(0, coordinatesOffset + index * 8);
    tiff.writeUInt32LE(1, coordinatesOffset + index * 8 + 4);
  }

  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Data = Buffer.concat([exifHeader, tiff]);
  const app1Length = Buffer.alloc(2);
  app1Length.writeUInt16BE(app1Data.length + 2);
  return Buffer.concat([
    jpeg.subarray(0, 2),
    Buffer.from([0xff, 0xe1]),
    app1Length,
    app1Data,
    jpeg.subarray(2),
  ]);
}

async function makeOversizedJpeg() {
  for (const edge of [2600, 3000, 3400]) {
    const pixels = randomFillSync(Buffer.alloc(edge * edge * 3));
    const source = sharp(pixels, {
      raw: { width: edge, height: edge, channels: 3 },
    });
    for (let quality = 85; quality <= 100; quality += 1) {
      const bytes = await source
        .clone()
        .jpeg({ quality, chromaSubsampling: '4:4:4' })
        .toBuffer();
      // Exercise HAMS's decimal 10 MB cap, not Cloudinary's 10 MiB cap.
      if (bytes.length > MAX_SOURCE_BYTES && bytes.length < 10_485_760)
        return bytes;
    }
  }
  throw new Error('Could not create oversized.jpg above the upload byte limit');
}

async function prepareFixtures() {
  await mkdir(outputDirectory, { recursive: true });

  await downloadFixture(
    'portrait.heic',
    'https://raw.githubusercontent.com/strukturag/libheif/f1fd74a3a72c324c421005f896d5c87e3b976215/tests/data/rainbow-451x461.heic',
  );
  await downloadFixture(
    'portrait.heif',
    // HEIC is a HEVC-encoded HEIF container; test both supported extension/MIME aliases.
    'https://raw.githubusercontent.com/strukturag/libheif/f1fd74a3a72c324c421005f896d5c87e3b976215/tests/data/rainbow-451x461.heic',
  );

  await writeFixture('jpeg.jpg', () =>
    sharp(syntheticSvg(640, 480)).jpeg({ quality: 92 }).toBuffer(),
  );
  await writeFixture('transparent.png', () =>
    sharp(syntheticSvg(640, 480, { transparent: true }))
      .png()
      .toBuffer(),
  );
  await writeFixture('static.webp', () =>
    sharp(syntheticSvg(640, 480)).webp({ quality: 90 }).toBuffer(),
  );
  await writeFixture('animated.webp', makeAnimatedWebp);
  await writeFixture('corrupt.jpg', async () =>
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00, 0x00]),
  );
  await writeFixture('unsupported.gif', async () =>
    Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
  );
  await writeFixture('oversized.jpg', makeOversizedJpeg);
  await writeFixture('large-pixel.png', () =>
    sharp({
      create: {
        width: 5001,
        height: 5001,
        channels: 3,
        background: { r: 42, g: 117, b: 166 },
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );

  await writeFixture('rotated.jpg', () =>
    sharp(syntheticSvg(640, 480))
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
  await writeFixture('mirrored.jpg', () =>
    sharp(syntheticSvg(640, 480, { variant: 1 }))
      .withMetadata({ orientation: 2 })
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
  await writeFixture('camera-gps-metadata.jpg', async () => {
    const jpeg = await sharp(syntheticSvg(640, 480, { variant: 2 }))
      .jpeg({ quality: 92 })
      .toBuffer();
    return createExifGpsJpeg(jpeg);
  });
  await writeFixture('semi-transparent.png', () =>
    sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><path d="M0 0h365v220H0z" fill="#d9485f"/><path d="M100 115h450v300H100z" fill="#1769aa" fill-opacity="0.45"/><circle cx="500" cy="70" r="42" fill="#24a148" fill-opacity="0.62"/></svg>',
      ),
    )
      .png()
      .toBuffer(),
  );
  await writeFixture('color-profile.jpg', () =>
    sharp(syntheticSvg(640, 480))
      .withIccProfile('srgb')
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
  await writeFixture('small.jpg', () =>
    sharp(syntheticSvg(800, 600, { variant: 1 }))
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
  await writeFixture('large-landscape.jpg', () =>
    sharp(syntheticSvg(2200, 1200, { variant: 2 }))
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
  await writeFixture('large-portrait.jpg', () =>
    sharp(syntheticSvg(1200, 2200, { variant: 1 }))
      .jpeg({ quality: 92 })
      .toBuffer(),
  );

  await validateFixtures();
  console.log(`\nCloudinary contract fixtures are ready at ${outputDirectory}`);
  console.log('This folder contains test-only images and is ignored by Git.');
}

async function validateFixtures() {
  const metadata = async (name, options) =>
    sharp(join(outputDirectory, name), options).metadata();

  for (const name of ['jpeg.jpg', 'transparent.png', 'static.webp']) {
    await access(join(outputDirectory, name));
  }
  const heic = await metadata('portrait.heic');
  if (heic.format !== 'heif' || heic.pages !== 1) {
    throw new Error('portrait.heic must be a valid still HEIC image');
  }
  assertHeifContainer(
    await readFile(join(outputDirectory, 'portrait.heif')),
    'portrait.heif',
  );

  const jpeg = await metadata('jpeg.jpg');
  const transparent = await metadata('transparent.png');
  const staticWebp = await metadata('static.webp');
  if (jpeg.format !== 'jpeg') throw new Error('jpeg.jpg must be a valid JPEG');
  if (transparent.format !== 'png' || !transparent.hasAlpha) {
    throw new Error('transparent.png must be a PNG with transparency');
  }
  if (staticWebp.format !== 'webp') {
    throw new Error('static.webp must be a still WebP image');
  }

  const animation = await metadata('animated.webp', { animated: true });
  if (animation.format !== 'webp' || (animation.pages ?? 1) < 2) {
    throw new Error('animated.webp must contain at least two frames');
  }
  let corruptRejected = false;
  try {
    await metadata('corrupt.jpg');
  } catch {
    corruptRejected = true;
  }
  if (!corruptRejected) {
    throw new Error('corrupt.jpg must not decode as an image');
  }
  const gif = await metadata('unsupported.gif');
  if (gif.format !== 'gif')
    throw new Error('unsupported.gif must be a valid GIF');

  const oversized = await stat(join(outputDirectory, 'oversized.jpg'));
  if (oversized.size <= MAX_SOURCE_BYTES || oversized.size >= 10_485_760) {
    throw new Error(
      'oversized.jpg must exceed 10,000,000 bytes but remain below 10 MiB',
    );
  }
  await metadata('oversized.jpg');
  const heif = await metadata('portrait.heif');
  if (heif.format !== 'heif' || heif.pages !== 1) {
    throw new Error('portrait.heif must be a decodable still HEIF container');
  }
  const largePng = await metadata('large-pixel.png');
  if ((largePng.width ?? 0) * (largePng.height ?? 0) <= MAX_SOURCE_PIXELS) {
    throw new Error('large-pixel.png must exceed 25,000,000 pixels');
  }

  const rotated = await metadata('rotated.jpg');
  const mirrored = await metadata('mirrored.jpg');
  const cameraGps = await metadata('camera-gps-metadata.jpg');
  const profiled = await metadata('color-profile.jpg');
  const alpha = await metadata('semi-transparent.png');
  const alphaPixels = await sharp(join(outputDirectory, 'semi-transparent.png'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaChannel = alphaPixels.info.channels - 1;
  let hasPartialAlpha = false;
  for (
    let pixel = alphaChannel;
    pixel < alphaPixels.data.length;
    pixel += alphaPixels.info.channels
  ) {
    if (alphaPixels.data[pixel] > 0 && alphaPixels.data[pixel] < 255) {
      hasPartialAlpha = true;
      break;
    }
  }
  const small = await metadata('small.jpg');
  const landscape = await metadata('large-landscape.jpg');
  const portrait = await metadata('large-portrait.jpg');
  if (![5, 6, 7, 8].includes(rotated.orientation ?? 0)) {
    throw new Error('rotated.jpg must have EXIF orientation 5–8');
  }
  if (![2, 4, 5, 7].includes(mirrored.orientation ?? 0)) {
    throw new Error('mirrored.jpg must have EXIF orientation 2, 4, 5, or 7');
  }
  if (!cameraGps.exif?.length)
    throw new Error('camera-gps-metadata.jpg needs EXIF');
  if (!profiled.icc?.length)
    throw new Error('color-profile.jpg needs an embedded ICC profile');
  if (!alpha.hasAlpha || !hasPartialAlpha) {
    throw new Error('semi-transparent.png must contain partial-alpha pixels');
  }
  if (Math.max(small.width ?? 0, small.height ?? 0) >= 1600) {
    throw new Error('small.jpg must have both edges below 1,600 pixels');
  }
  if (
    (landscape.width ?? 0) <= (landscape.height ?? 0) ||
    (landscape.width ?? 0) <= 1600
  ) {
    throw new Error(
      'large-landscape.jpg must be landscape and wider than 1,600 pixels',
    );
  }
  if (
    (portrait.height ?? 0) <= (portrait.width ?? 0) ||
    (portrait.height ?? 0) <= 1600
  ) {
    throw new Error(
      'large-portrait.jpg must be portrait and taller than 1,600 pixels',
    );
  }
}

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm fixtures:cloudinary -- [--dir <path>] [--force]');
  console.log(
    'Defaults to CLOUDINARY_CONTRACT_FIXTURE_DIR or test/fixtures/cloudinary-contract.',
  );
} else {
  try {
    await prepareFixtures();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not prepare Cloudinary fixtures: ${message}`);
    process.exitCode = 1;
  }
}
