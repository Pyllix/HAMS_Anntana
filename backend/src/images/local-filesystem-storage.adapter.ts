import { createReadStream, createWriteStream } from 'node:fs';
import {
  lstat,
  mkdir,
  realpath,
  readdir,
  stat,
  unlink,
  rmdir,
  utimes,
} from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import type { RuntimeConfig } from '../common/config/runtime-config';
import {
  ImageStorageError,
  type ImageObjectReference,
  type ImageStorageContext,
  type ImageStoragePort,
  type ImageUploadPolicy,
  type ShortLivedImageGrant,
  type UploadEvidence,
  type UploadInstructions,
  type UploadInstructionsInput,
  type VerifiedImageObject,
  type VerifyUploadedObjectInput,
} from './image-storage.port';
import { ImageNormalizer } from './image-normalizer';

const LOCAL_PROVIDER = 'local';
const LOCAL_ACCOUNT_ID = 'hams-local-image-store-v1';
const PUBLIC_ID_PATTERN =
  /^hams-(?:asset-image|employee-photo)-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_PUBLIC_ID_PATTERN =
  /^hams-asset-image-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ImageDirectoryConfig = RuntimeConfig['images'];

export class LocalFilesystemStorageAdapter implements ImageStoragePort {
  private storageRoot: string | null = null;
  private tempRoot: string | null = null;
  private directoryInitialization: Promise<void> | null = null;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly config: ImageDirectoryConfig,
    private readonly normalizer = new ImageNormalizer(),
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDirectories();
  }

  getProviderContext(): ImageStorageContext {
    if (this.config.provider !== LOCAL_PROVIDER || !this.config.storageRoot) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Local image storage is not configured',
      );
    }
    return { provider: LOCAL_PROVIDER, accountId: LOCAL_ACCOUNT_ID };
  }

  createUploadInstructions(input: UploadInstructionsInput): UploadInstructions {
    this.assertContext(input.storageContext);
    if (input.deliveryType !== 'upload') {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Private Employee Photo reads are enabled by the next image ticket',
      );
    }
    const uploadId = this.uploadIdFromPublicId(input.publicId);
    const endpoint = `/images/uploads/${uploadId}/file`;
    return {
      transport: {
        kind: 'hams-binary-v1',
        endpoint,
        method: 'POST',
        fields: {},
        expiresAt: input.signatureExpiresAt,
      },
      url: endpoint,
      method: 'POST',
      fields: {},
      expiresAt: input.signatureExpiresAt,
    };
  }

  async receiveLocalUpload(input: {
    readonly publicId: string;
    readonly stream: Readable;
    readonly policy: ImageUploadPolicy;
    readonly receivedAt: Date;
  }): Promise<UploadEvidence> {
    if (!Number.isFinite(input.receivedAt.getTime())) {
      throw this.policyRejected('The local upload receipt time is invalid');
    }
    this.assertPublicId(input.publicId);
    await this.ensureDirectories();
    return this.withObjectLock(input.publicId, async () => {
      const sourceDirectory = this.sourceDirectory(input.publicId);
      await this.ensureSafeDirectory(this.requireTempRoot(), sourceDirectory);
      const sourcePath = this.sourcePath(input.publicId);
      const existing = await this.safeFileStat(sourcePath);
      if (existing) {
        if (existing.size < 1 || existing.size > input.policy.maxSourceBytes) {
          throw this.policyRejected(
            'The stored source image exceeds the byte limit',
          );
        }
        await this.drainWithinLimit(input.stream, input.policy.maxSourceBytes);
        return {
          publicId: input.publicId,
          version: 1,
          sourceBytes: existing.size,
        };
      }

      let sourceBytes = 0;
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          sourceBytes += chunk.length;
          if (sourceBytes > input.policy.maxSourceBytes) {
            callback(
              new ImageStorageError(
                'OBJECT_POLICY_REJECTED',
                'The source image exceeds the byte limit',
              ),
            );
            return;
          }
          callback(null, chunk);
        },
      });
      try {
        await pipeline(
          input.stream,
          limit,
          createWriteStream(sourcePath, { flags: 'wx', mode: 0o600 }),
        );
      } catch (error) {
        if (this.errorCode(error) === 'EEXIST') {
          throw new ImageStorageError(
            'OBJECT_POLICY_REJECTED',
            'An image has already been received for this upload',
          );
        }
        await this.removeFileIfPresent(sourcePath);
        if (sourceBytes > input.policy.maxSourceBytes) {
          throw this.policyRejected('The source image exceeds the byte limit');
        }
        if (isImageStorageError(error)) throw error;
        throw new ImageStorageError(
          'UNAVAILABLE',
          'The local image could not be written',
        );
      }
      if (sourceBytes < 1) {
        await this.removeFileIfPresent(sourcePath);
        throw this.policyRejected('The source image is empty');
      }
      try {
        await utimes(sourcePath, input.receivedAt, input.receivedAt);
      } catch {
        await this.removeFileIfPresent(sourcePath);
        throw new ImageStorageError(
          'UNAVAILABLE',
          'The local upload receipt time could not be recorded',
        );
      }
      return { publicId: input.publicId, version: 1, sourceBytes };
    });
  }

  fingerprintUploadEvidence(
    publicId: string,
    storageContext: ImageStorageContext,
    evidence: UploadEvidence,
  ): string {
    this.assertContext(storageContext);
    this.assertPublicId(publicId);
    if (evidence.publicId !== publicId || evidence.version !== 1) {
      throw new ImageStorageError(
        'EVIDENCE_INVALID',
        'The local upload evidence does not match its allocated image',
      );
    }
    return `${publicId}\n1`;
  }

  async verifyUploadedObject(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifiedImageObject> {
    this.assertContext(input.storageContext);
    this.assertPublicId(input.publicId);
    if (
      input.deliveryType !== 'upload' ||
      input.evidence.publicId !== input.publicId ||
      input.evidence.version !== 1
    ) {
      throw new ImageStorageError(
        'EVIDENCE_INVALID',
        'The local upload evidence is invalid',
      );
    }
    await this.ensureDirectories();
    return this.withObjectLock(input.publicId, () =>
      this.verifyUploadedObjectLocked(input),
    );
  }

  publicUrl(reference: ImageObjectReference): string {
    this.assertContext(reference.storageContext);
    this.assertPublicReference(reference);
    return `/api/images/assets/${encodeURIComponent(reference.publicId)}/v${reference.version}.jpg`;
  }

  async openPublicAsset(reference: ImageObjectReference): Promise<{
    readonly stream: Readable;
    readonly bytes: number;
  }> {
    this.assertContext(reference.storageContext);
    this.assertPublicReference(reference);
    await this.ensureDirectories();
    const objectDirectory = this.objectDirectory(reference.publicId);
    const directoryStat = await this.safeFileStat(objectDirectory);
    if (!directoryStat || !directoryStat.isDirectory()) {
      throw this.objectNotFound();
    }
    const imagePath = this.objectPath(reference.publicId, reference.version!);
    const fileStat = await this.safeFileStat(imagePath);
    if (!fileStat || !fileStat.isFile()) throw this.objectNotFound();
    const verifiedMarker = await this.safeFileStat(
      this.verifiedMarkerPath(reference.publicId),
    );
    if (!verifiedMarker || !verifiedMarker.isDirectory()) {
      throw this.objectNotFound();
    }
    await this.assertRealPathWithin(
      this.requireStorageRoot(),
      this.verifiedMarkerPath(reference.publicId),
    );
    await this.assertRealPathWithin(this.requireStorageRoot(), imagePath);
    return { stream: createReadStream(imagePath), bytes: fileStat.size };
  }

  createShortLivedReadGrant(): ShortLivedImageGrant {
    throw new ImageStorageError(
      'UNAVAILABLE',
      'Private Employee Photo grants are implemented by the next image ticket',
    );
  }

  validateShortLivedReadGrant(): void {
    throw new ImageStorageError(
      'UNAVAILABLE',
      'Private Employee Photo grants are implemented by the next image ticket',
    );
  }

  async deleteObject(reference: ImageObjectReference): Promise<void> {
    this.assertContext(reference.storageContext);
    this.assertPublicId(reference.publicId);
    if (
      reference.version === undefined ||
      !Number.isSafeInteger(reference.version) ||
      reference.version < 1
    ) {
      throw this.policyRejected('The image version is invalid');
    }
    await this.ensureDirectories();
    await this.withObjectLock(reference.publicId, async () => {
      await this.removeFileIfPresent(
        this.objectPath(reference.publicId, reference.version!),
      );
      await this.removeVerifiedMarker(reference.publicId);
    });
  }

  async deleteAllocatedImageVariants(input: {
    readonly publicId: string;
    readonly storageContext: ImageStorageContext;
  }): Promise<void> {
    this.assertContext(input.storageContext);
    this.assertPublicId(input.publicId);
    await this.ensureDirectories();
    await this.withObjectLock(input.publicId, async () => {
      await this.removeOwnedDirectoryContents(
        this.requireStorageRoot(),
        this.objectDirectory(input.publicId),
        /^v[1-9]\d*\.jpg$/i,
      );
      await this.removeOwnedDirectoryContents(
        this.requireTempRoot(),
        this.sourceDirectory(input.publicId),
        /^source\.upload$/,
      );
    });
  }

  private async verifyUploadedObjectLocked(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifiedImageObject> {
    const sourcePath = this.sourcePath(input.publicId);
    const outputPath = this.objectPath(input.publicId, 1);
    const existingOutput = await this.safeFileStat(outputPath);
    let normalized: {
      format: 'jpg';
      bytes: number;
      width: number;
      height: number;
      pages: 1;
    };
    let createdAt: Date;
    if (existingOutput) {
      const sourceStat = await this.safeFileStat(sourcePath);
      if (sourceStat && !sourceStat.isFile()) throw this.objectNotFound();
      try {
        normalized = await this.inspectNormalizedOutput(
          outputPath,
          input.policy,
        );
        if (sourceStat) {
          await utimes(outputPath, sourceStat.atime, sourceStat.mtime);
        }
        await this.ensureVerifiedMarker(input.publicId);
        createdAt = sourceStat?.mtime ?? existingOutput.mtime;
        await this.removeFileIfPresent(sourcePath);
      } catch (error) {
        if (!sourceStat || !isImageStorageError(error)) throw error;
        await this.removeFileIfPresent(outputPath);
        await this.removeVerifiedMarker(input.publicId);
        return this.verifyUploadedObjectLocked(input);
      }
    } else {
      const sourceStat = await this.safeFileStat(sourcePath);
      if (!sourceStat || !sourceStat.isFile()) throw this.objectNotFound();
      const objectDirectory = this.objectDirectory(input.publicId);
      await this.ensureSafeDirectory(
        this.requireStorageRoot(),
        objectDirectory,
      );
      try {
        normalized = await this.normalizer.normalize(
          sourcePath,
          outputPath,
          input.policy,
        );
        normalized = await this.inspectNormalizedOutput(
          outputPath,
          input.policy,
        );
        await utimes(outputPath, sourceStat.atime, sourceStat.mtime);
        await this.ensureVerifiedMarker(input.publicId);
      } catch (error) {
        await this.removeFileIfPresent(outputPath);
        await this.removeVerifiedMarker(input.publicId);
        if (isImageStorageError(error)) throw error;
        throw new ImageStorageError(
          'UNAVAILABLE',
          error instanceof Error
            ? `The local image could not be normalized: ${error.message}`
            : 'The local image could not be normalized',
        );
      }
      const outputStat = await stat(outputPath).catch(() => null);
      if (!outputStat || !outputStat.isFile()) {
        throw new ImageStorageError(
          'UNAVAILABLE',
          'The normalized image could not be verified',
        );
      }
      createdAt = sourceStat.mtime;
      await this.removeFileIfPresent(sourcePath);
    }

    return {
      publicId: input.publicId,
      version: 1,
      resourceType: 'image',
      deliveryType: input.deliveryType,
      createdAt,
      format: normalized.format,
      bytes: normalized.bytes,
      width: normalized.width,
      height: normalized.height,
      pages: normalized.pages,
      sourcePolicyRevision: input.policy.revision,
    };
  }

  private async inspectNormalizedOutput(
    outputPath: string,
    policy: ImageUploadPolicy,
  ): Promise<{
    format: 'jpg';
    bytes: number;
    width: number;
    height: number;
    pages: 1;
  }> {
    try {
      const [metadata, fileStat] = await Promise.all([
        sharp(outputPath).metadata(),
        stat(outputPath),
      ]);
      if (
        metadata.format !== 'jpeg' ||
        (metadata.pages ?? 1) !== 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > policy.maxEdge ||
        metadata.height > policy.maxEdge ||
        fileStat.size < 1
      ) {
        throw this.policyRejected('The normalized image does not meet policy');
      }
      return {
        format: 'jpg',
        bytes: fileStat.size,
        width: metadata.width,
        height: metadata.height,
        pages: 1,
      };
    } catch (error) {
      if (isImageStorageError(error)) throw error;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'The normalized image could not be read',
      );
    }
  }

  private async ensureDirectories(): Promise<void> {
    if (!this.directoryInitialization) {
      this.directoryInitialization = this.initializeDirectories();
    }
    return this.directoryInitialization;
  }

  private async initializeDirectories(): Promise<void> {
    const configuredStorageRoot = this.config.storageRoot;
    const configuredTempRoot = this.config.tempRoot;
    if (
      this.config.provider !== LOCAL_PROVIDER ||
      !configuredStorageRoot ||
      !configuredTempRoot ||
      !path.isAbsolute(configuredStorageRoot) ||
      !path.isAbsolute(configuredTempRoot)
    ) {
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Local image storage paths are not configured',
      );
    }
    try {
      await Promise.all([
        mkdir(configuredStorageRoot, { recursive: true, mode: 0o700 }),
        mkdir(configuredTempRoot, { recursive: true, mode: 0o700 }),
      ]);
      this.storageRoot = await realpath(configuredStorageRoot);
      this.tempRoot = await realpath(configuredTempRoot);
      const applicationRoot = await realpath(path.resolve(__dirname, '../..'));
      if (
        this.isContainedPath(applicationRoot, this.storageRoot) ||
        this.isContainedPath(applicationRoot, this.tempRoot)
      ) {
        throw new Error(
          'Local image roots must be outside the release directory',
        );
      }
      if (
        this.realRootsOverlap(this.storageRoot, this.tempRoot) &&
        !this.isDefaultStagingRoot(this.storageRoot, this.tempRoot)
      ) {
        throw new Error('Local image storage roots must be separate');
      }
    } catch {
      this.directoryInitialization = null;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'Local image storage directories are unavailable',
      );
    }
  }

  private async ensureSafeDirectory(
    root: string,
    directory: string,
  ): Promise<void> {
    const resolved = path.resolve(directory);
    this.assertContainedPath(root, resolved);
    try {
      await mkdir(resolved, { recursive: true, mode: 0o700 });
      const metadata = await lstat(resolved);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw this.policyRejected(
          'The local image path is not a safe directory',
        );
      }
      await this.assertRealPathWithin(root, resolved);
    } catch (error) {
      if (isImageStorageError(error)) throw error;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'The local image directory is unavailable',
      );
    }
  }

  private async safeFileStat(filePath: string) {
    try {
      const metadata = await lstat(filePath);
      if (metadata.isSymbolicLink()) {
        throw this.policyRejected('Symbolic links are not valid image files');
      }
      return metadata;
    } catch (error) {
      if (this.errorCode(error) === 'ENOENT') return null;
      if (isImageStorageError(error)) throw error;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'A local image path could not be inspected',
      );
    }
  }

  private async assertRealPathWithin(
    root: string,
    candidate: string,
  ): Promise<void> {
    const actual = await realpath(candidate).catch(() => null);
    if (!actual || !this.isContainedPath(root, actual)) {
      throw this.policyRejected(
        'The local image path escaped its configured directory',
      );
    }
  }

  private assertContainedPath(root: string, candidate: string): void {
    if (!this.isContainedPath(root, candidate)) {
      throw this.policyRejected(
        'The local image path escaped its configured directory',
      );
    }
  }

  private isContainedPath(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return (
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  }

  private realRootsOverlap(left: string, right: string): boolean {
    return (
      this.isContainedPath(left, right) || this.isContainedPath(right, left)
    );
  }

  private isDefaultStagingRoot(storageRoot: string, tempRoot: string): boolean {
    return path.relative(storageRoot, tempRoot) === '.staging';
  }

  private async removeFileIfPresent(filePath: string): Promise<void> {
    const fileStat = await this.safeFileStat(filePath);
    if (!fileStat) return;
    if (!fileStat.isFile()) {
      throw this.policyRejected('The local image path is not a file');
    }
    await unlink(filePath);
  }

  private async removeOwnedDirectoryContents(
    root: string,
    directory: string,
    allowedName: RegExp,
  ): Promise<void> {
    const directoryStat = await this.safeFileStat(directory);
    if (!directoryStat) return;
    if (directoryStat.isSymbolicLink()) {
      await unlink(directory);
      return;
    }
    if (!directoryStat.isDirectory()) {
      throw this.policyRejected('The local image path is not a directory');
    }
    await this.assertRealPathWithin(root, directory);
    const entries = await readdir(directory);
    for (const name of entries) {
      if (name !== '.verified' && !allowedName.test(name)) {
        throw this.policyRejected(
          'The local image directory contains an unmanaged path',
        );
      }
      const entryPath = path.join(directory, name);
      const entryStat = await this.safeFileStat(entryPath);
      if (!entryStat) continue;
      if (name === '.verified' && entryStat.isDirectory()) {
        await this.assertRealPathWithin(root, entryPath);
        if ((await readdir(entryPath)).length !== 0) {
          throw this.policyRejected(
            'The local image marker directory is not empty',
          );
        }
        await rmdir(entryPath);
        continue;
      }
      if (!entryStat.isFile()) {
        throw this.policyRejected(
          'The local image directory contains a non-file entry',
        );
      }
      await this.assertRealPathWithin(root, entryPath);
      await unlink(entryPath);
    }
    await rmdir(directory);
  }

  private async withObjectLock<T>(
    publicId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.locks.get(publicId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(publicId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(publicId) === current) this.locks.delete(publicId);
    }
  }

  private async drainWithinLimit(
    stream: Readable,
    maximumBytes: number,
  ): Promise<void> {
    let receivedBytes = 0;
    try {
      for await (const chunk of stream) {
        receivedBytes += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk));
        if (receivedBytes > maximumBytes) {
          stream.destroy();
          throw this.policyRejected('The source image exceeds the byte limit');
        }
      }
    } catch (error) {
      if (isImageStorageError(error)) throw error;
      throw new ImageStorageError(
        'UNAVAILABLE',
        'The local image retry could not be received',
      );
    }
  }

  private assertContext(context: ImageStorageContext): void {
    if (
      this.config.provider !== LOCAL_PROVIDER ||
      context.provider !== LOCAL_PROVIDER ||
      context.accountId !== LOCAL_ACCOUNT_ID
    ) {
      throw this.policyRejected('The image storage identity is invalid');
    }
  }

  private assertPublicReference(reference: ImageObjectReference): void {
    if (
      reference.resourceType !== 'image' ||
      reference.deliveryType !== 'upload' ||
      !reference.version ||
      !Number.isSafeInteger(reference.version) ||
      !ASSET_PUBLIC_ID_PATTERN.test(reference.publicId)
    ) {
      throw this.policyRejected('Only versioned Asset Images are public');
    }
  }

  private assertPublicId(publicId: string): void {
    if (!PUBLIC_ID_PATTERN.test(publicId)) {
      throw this.policyRejected('The allocated image identity is invalid');
    }
  }

  private uploadIdFromPublicId(publicId: string): string {
    this.assertPublicId(publicId);
    const match = /^hams-(?:asset-image|employee-photo)-(.+)$/i.exec(publicId);
    if (!match)
      throw this.policyRejected('The allocated image identity is invalid');
    return match[1];
  }

  private objectDirectory(publicId: string): string {
    return path.join(this.requireStorageRoot(), publicId);
  }

  private objectPath(publicId: string, version: number): string {
    return path.join(this.objectDirectory(publicId), `v${version}.jpg`);
  }

  private verifiedMarkerPath(publicId: string): string {
    return path.join(this.objectDirectory(publicId), '.verified');
  }

  private async ensureVerifiedMarker(publicId: string): Promise<void> {
    const markerPath = this.verifiedMarkerPath(publicId);
    try {
      await mkdir(markerPath, { recursive: false, mode: 0o700 });
    } catch (error) {
      if (this.errorCode(error) !== 'EEXIST') {
        throw new ImageStorageError(
          'UNAVAILABLE',
          'The normalized image could not be marked as verified',
        );
      }
    }
    const markerStat = await this.safeFileStat(markerPath);
    if (!markerStat || !markerStat.isDirectory()) {
      throw this.policyRejected(
        'The normalized image verification marker is invalid',
      );
    }
    await this.assertRealPathWithin(this.requireStorageRoot(), markerPath);
  }

  private async removeVerifiedMarker(publicId: string): Promise<void> {
    const markerPath = this.verifiedMarkerPath(publicId);
    const markerStat = await this.safeFileStat(markerPath);
    if (!markerStat) return;
    if (!markerStat.isDirectory() || (await readdir(markerPath)).length > 0) {
      throw this.policyRejected(
        'The normalized image verification marker is invalid',
      );
    }
    await rmdir(markerPath);
  }

  private sourceDirectory(publicId: string): string {
    return path.join(this.requireTempRoot(), publicId);
  }

  private sourcePath(publicId: string): string {
    return path.join(this.sourceDirectory(publicId), 'source.upload');
  }

  private requireStorageRoot(): string {
    if (!this.storageRoot) throw this.directoriesUnavailable();
    return this.storageRoot;
  }

  private requireTempRoot(): string {
    if (!this.tempRoot) throw this.directoriesUnavailable();
    return this.tempRoot;
  }

  private directoriesUnavailable(): ImageStorageError {
    return new ImageStorageError(
      'UNAVAILABLE',
      'Local image storage directories are unavailable',
    );
  }

  private objectNotFound(): ImageStorageError {
    return new ImageStorageError(
      'OBJECT_NOT_FOUND',
      'The allocated local image was not found',
    );
  }

  private policyRejected(message: string): ImageStorageError {
    return new ImageStorageError('OBJECT_POLICY_REJECTED', message);
  }

  private errorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
      return String(error.code);
    }
    return undefined;
  }
}

function isImageStorageError(error: unknown): error is ImageStorageError {
  return (
    error instanceof Error &&
    error.name === 'ImageStorageError' &&
    'code' in error &&
    [
      'EVIDENCE_INVALID',
      'OBJECT_NOT_FOUND',
      'OBJECT_POLICY_REJECTED',
      'UNAVAILABLE',
    ].includes(String(error.code))
  );
}
