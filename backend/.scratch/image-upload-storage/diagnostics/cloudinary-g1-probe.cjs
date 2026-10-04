// Diagnostic harness only. Does not change the production adapter or policy.
// Run with: node -r ts-node/register/transpile-only <this file> <mode>
const { createHash, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const dotenv = require('dotenv');
const sharp = require('sharp');
const {
  CloudinaryStorageAdapter,
} = require('../../../src/images/cloudinary-storage.adapter.ts');
const {
  imageUploadPolicy,
} = require('../../../src/images/image-upload-policy.ts');

dotenv.config({ path: '.env.local', quiet: true });
const mainEnv = dotenv.parse(readFileSync('.env'));
const cloud = process.env.CLOUDINARY_CONTRACT_CLOUD_NAME?.trim();
const key = process.env.CLOUDINARY_CONTRACT_API_KEY?.trim();
const secret = process.env.CLOUDINARY_CONTRACT_API_SECRET?.trim();
if (
  !cloud ||
  !key ||
  !secret ||
  !/^[a-z\d_-]+$/i.test(cloud) ||
  cloud.toLowerCase() === mainEnv.CLOUDINARY_CLOUD_NAME?.trim().toLowerCase()
) {
  throw new Error(
    'A configured, separate test-only Cloudinary environment is required',
  );
}
process.env.CLOUDINARY_CLOUD_NAME = cloud;
process.env.CLOUDINARY_API_KEY = key;
process.env.CLOUDINARY_API_SECRET = secret;
const adapter = new CloudinaryStorageAdapter();
const storageContext = adapter.getProviderContext();
const fixtureDir = resolve(
  process.env.CLOUDINARY_CONTRACT_FIXTURE_DIR ||
    'test/fixtures/cloudinary-contract',
);
const prefix = 'hams-diag-g1-' + randomUUID() + '-';
const objects = new Map();
const authorization =
  'Basic ' + Buffer.from(key + ':' + secret).toString('base64');

function remember(reference) {
  if (!reference.publicId.startsWith(prefix))
    throw new Error('Refusing non-diagnostic identity');
  objects.set(
    [reference.resourceType, reference.deliveryType, reference.publicId].join(
      ':',
    ),
    reference,
  );
}

function redact(message) {
  return String(message)
    .split(secret)
    .join('[secret]')
    .split(key)
    .join('[key]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/[a-f\d]{40,}/gi, '[digest]')
    .slice(0, 400);
}

function resign(fields) {
  const signed = Object.entries(fields)
    .filter(([k, v]) => !['api_key', 'signature'].includes(k) && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + '=' + v)
    .join('&');
  fields.signature = createHash('sha1')
    .update(signed + secret)
    .digest('hex');
}

async function probe(label, filename, options = {}) {
  const purpose = options.employee ? 'EMPLOYEE_PHOTO' : 'ASSET_IMAGE';
  const type = options.employee ? 'authenticated' : 'upload';
  const policy = imageUploadPolicy(purpose, options.maxBytes);
  const publicId = prefix + label;
  const now = new Date();
  const reference = {
    publicId,
    storageContext,
    resourceType: 'image',
    deliveryType: type,
  };
  remember(reference);
  const instructions = await adapter.createUploadInstructions({
    purpose,
    publicId,
    storageContext,
    deliveryType: type,
    policy,
    issuedAt: now,
    signatureExpiresAt: new Date(now.getTime() + 3600000),
  });
  const fields = { ...instructions.fields };
  let url = instructions.url;
  if (options.correctEndpoint) {
    url = 'https://api.cloudinary.com/v1_1/' + cloud + '/image/upload';
    fields.type = type;
  }
  if (options.raw) {
    url = 'https://api.cloudinary.com/v1_1/' + cloud + '/raw/upload';
    fields.type = type;
  }
  if (options.eval !== undefined) fields.eval = options.eval;
  if (options.evalPrefix) fields.eval = options.evalPrefix + fields.eval;
  if (
    options.correctEndpoint ||
    options.raw ||
    options.eval !== undefined ||
    options.evalPrefix
  )
    resign(fields);
  if (options.tamperType) fields.type = 'upload';
  const bytes = options.bytes || readFileSync(resolve(fixtureDir, filename));
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  body.append(
    'file',
    new Blob([bytes], { type: options.mime || 'image/jpeg' }),
    filename,
  );
  const start = performance.now();
  console.log(
    JSON.stringify({ phase: 'start', label, sourceBytes: bytes.length }),
  );
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(options.timeout || 20000),
    });
    const payload = await response.json().catch(() => ({}));
    const result = {
      label,
      status: response.status,
      elapsedMs: Math.round(performance.now() - start),
      sourceBytes: bytes.length,
      error: payload.error ? redact(payload.error.message) : undefined,
      resourceType: payload.resource_type,
      deliveryType: payload.type,
      format: payload.format,
      width: payload.width,
      height: payload.height,
      storedBytes: payload.bytes,
      sourcePolicyRevision: payload.context?.custom?.hams_policy_rev,
      diagnosticOptionType: payload.context?.custom?.diag_option_type,
      diagnosticOptionResourceType: payload.context?.custom?.diag_option_rt,
      diagnosticInfoResourceType: payload.context?.custom?.diag_info_rt,
      diagnosticOptionKeys: payload.context?.custom?.diag_option_keys,
      diagnosticInfoKeys: payload.context?.custom?.diag_info_keys,
    };
    if (response.ok) {
      result.publicIdMatchesAllocation = payload.public_id === publicId;
      result.returnedKeySuffix = payload.public_id.startsWith(publicId)
        ? payload.public_id.slice(publicId.length)
        : '[unexpected identity]';
      remember({
        publicId: payload.public_id,
        storageContext,
        resourceType: payload.resource_type,
        deliveryType: payload.type,
      });
      if (payload.resource_type === 'raw') {
        try {
          await adapter.verifyUploadedObject({
            publicId,
            storageContext,
            deliveryType: type,
            policy,
            evidence: {
              publicId: payload.public_id,
              version: payload.version,
              signature: payload.signature,
            },
          });
          result.hamsVerification = 'accepted';
        } catch (error) {
          result.hamsVerification = error.code || error.constructor.name;
        }
        if (type === 'authenticated') {
          const unsigned =
            'https://res.cloudinary.com/' +
            cloud +
            '/raw/authenticated/v' +
            payload.version +
            '/' +
            payload.public_id;
          result.anonymousReadStatus = (
            await fetch(unsigned, { signal: AbortSignal.timeout(10000) })
          ).status;
        }
      }
      if (payload.resource_type === 'image' && payload.type === type) {
        try {
          await adapter.verifyUploadedObject({
            publicId,
            storageContext,
            deliveryType: type,
            policy,
            evidence: {
              publicId: payload.public_id,
              version: payload.version,
              signature: payload.signature,
            },
          });
          result.hamsVerification = 'accepted';
        } catch (error) {
          result.hamsVerification = error.code || error.constructor.name;
        }
        if (type === 'authenticated') {
          const unsigned =
            'https://res.cloudinary.com/' +
            cloud +
            '/image/authenticated/v' +
            payload.version +
            '/' +
            publicId +
            '.jpg';
          result.anonymousReadStatus = (
            await fetch(unsigned, { signal: AbortSignal.timeout(10000) })
          ).status;
          const grant = await adapter.createShortLivedReadGrant(
            { ...reference, version: payload.version },
            new Date(Date.now() + 300000),
          );
          const read = await fetch(grant.url, {
            signal: AbortSignal.timeout(10000),
          });
          result.authorizedReadStatus = read.status;
          if (read.ok) {
            const metadata = await sharp(
              Buffer.from(await read.arrayBuffer()),
            ).metadata();
            result.downloadFormat = metadata.format;
            result.downloadHasExif = !!metadata.exif;
          }
        }
      }
    }
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    console.log(
      JSON.stringify({
        label,
        elapsedMs: Math.round(performance.now() - start),
        error: redact(error.message),
      }),
    );
    return { label, transportFailure: true };
  }
}

async function cleanup() {
  let failed = 0;
  for (const reference of objects.values()) {
    let deleted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await adapter.deleteObject(reference);
        deleted = true;
        break;
      } catch {
        await new Promise((done) => setTimeout(done, 500));
      }
    }
    if (!deleted) {
      failed++;
      console.log(JSON.stringify({ cleanupFailure: reference }));
    }
  }
  let remaining = 0;
  for (const [kind, type] of [
    ['image', 'upload'],
    ['image', 'authenticated'],
    ['raw', 'upload'],
    ['raw', 'authenticated'],
  ]) {
    const url = new URL(
      'https://api.cloudinary.com/v1_1/' +
        cloud +
        '/resources/' +
        kind +
        '/' +
        type,
    );
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('max_results', '500');
    const response = await fetch(url, {
      headers: { authorization },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error('Cleanup verification failed: ' + response.status);
    remaining += (await response.json()).resources.length;
  }
  console.log(
    JSON.stringify({
      phase: 'cleanup',
      allocatedReferences: objects.size,
      failures: failed,
      remaining,
    }),
  );
  if (failed || remaining) process.exitCode = 1;
}

async function run() {
  try {
    if (process.argv[2] === 'baseline-employee') {
      const result = await probe('baseline-employee', 'jpeg.jpg', {
        employee: true,
      });
      if (
        result.status !== 200 ||
        result.deliveryType !== 'authenticated' ||
        result.hamsVerification !== 'accepted'
      ) {
        throw new Error(
          'Employee upload regression: expected verified authenticated JPEG, received HTTP ' +
            result.status,
        );
      }
    } else if (process.argv[2] === 'routes') {
      await probe('original-employee-jpeg', 'jpeg.jpg', { employee: true });
      await probe('correct-employee-jpeg', 'jpeg.jpg', {
        employee: true,
        correctEndpoint: true,
      });
      await probe('correct-employee-heic', 'portrait.heic', {
        employee: true,
        correctEndpoint: true,
        mime: 'image/heic',
      });
      await probe('correct-employee-heif', 'portrait.heif', {
        employee: true,
        correctEndpoint: true,
        mime: 'image/heif',
      });
      await probe('employee-type-tamper', 'jpeg.jpg', {
        employee: true,
        correctEndpoint: true,
        tamperType: true,
      });
      await probe('raw-current-policy', 'jpeg.jpg', { raw: true });
      await probe('image-eval-throw', 'jpeg.jpg', {
        eval: 'throw new Error("HAMS_DIAG_REJECT");',
      });
      await probe('raw-eval-throw', 'jpeg.jpg', {
        raw: true,
        eval: 'throw new Error("HAMS_DIAG_REJECT");',
      });
      await probe('raw-corrupt-current-policy', 'corrupt.jpg', { raw: true });
    } else if (process.argv[2] === 'namespace') {
      const inspect =
        'upload_options.context = "diag_option_rt=" + String(upload_options.resource_type) + "|diag_info_rt=" + String(resource_info.resource_type) + "|diag_option_type=" + String(upload_options.type) + "|diag_option_keys=" + Object.keys(upload_options).sort().join(",") + "|diag_info_keys=" + Object.keys(resource_info).sort().join(",");';
      await probe('namespace-inspect-image', 'jpeg.jpg', { eval: inspect });
      await probe('namespace-inspect-raw', 'jpeg.jpg', {
        raw: true,
        eval: inspect,
      });
      const guard =
        'if (upload_options.resource_type !== "image") { throw new Error("HAMS_DIAG_NON_IMAGE_REQUEST"); }';
      await probe('namespace-guard-image', 'jpeg.jpg', { evalPrefix: guard });
      await probe('namespace-guard-raw', 'jpeg.jpg', {
        raw: true,
        evalPrefix: guard,
      });
      await probe('standard-heif-container', 'portrait.heif', {
        employee: true,
        correctEndpoint: true,
        mime: 'image/heif',
        bytes: readFileSync(resolve(fixtureDir, 'portrait.heic')),
      });
    } else if (process.argv[2] === 'raw-acceptance') {
      await probe('raw-asset-completion', 'jpeg.jpg', { raw: true });
      await probe('raw-employee-completion', 'jpeg.jpg', {
        raw: true,
        employee: true,
      });
      await probe('raw-employee-type-tamper', 'jpeg.jpg', {
        raw: true,
        employee: true,
        tamperType: true,
      });
      await probe('raw-animation', 'animated.webp', {
        raw: true,
        mime: 'image/webp',
      });
      await probe('raw-disallowed-format', 'unsupported.gif', {
        raw: true,
        mime: 'image/gif',
      });
      await probe('raw-source-limit-1024', 'jpeg.jpg', {
        raw: true,
        maxBytes: 1024,
      });
    } else if (process.argv[2] === 'raw-identities') {
      const bytes = readFileSync(resolve(fixtureDir, 'jpeg.jpg'));
      for (const filename of ['probe.jpg', 'probe.png', 'probe.bin', 'probe']) {
        await probe('raw-identity-' + filename.replace('.', '-'), filename, {
          raw: true,
          bytes,
        });
      }
    } else if (process.argv[2] === 'original-size') {
      await probe('source-limit-original-19mb', 'oversized.jpg', {
        timeout: 120000,
      });
    } else if (process.argv[2] === 'size') {
      await probe('source-limit-1024', 'jpeg.jpg', { maxBytes: 1024 });
      const small = readFileSync(resolve(fixtureDir, 'jpeg.jpg'));
      const padded = Buffer.concat([
        small,
        Buffer.alloc(10000001 - small.length),
      ]);
      await probe('source-limit-10mb-padded', 'padded.jpg', {
        bytes: padded,
        timeout: 120000,
      });
      const original = readFileSync(resolve(fixtureDir, 'oversized.jpg'));
      let candidate = original;
      for (let quality = 99; quality >= 85; quality--) {
        const encoded = await sharp(original)
          .jpeg({ quality, chromaSubsampling: '4:4:4' })
          .toBuffer();
        if (encoded.length <= 10000000) break;
        candidate = encoded;
      }
      await probe('source-limit-10mb-reencoded', 'oversized.jpg', {
        bytes: candidate,
        timeout: 120000,
      });
    } else {
      throw new Error('Choose routes or size');
    }
  } finally {
    await cleanup();
  }
}
run().catch((error) => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
