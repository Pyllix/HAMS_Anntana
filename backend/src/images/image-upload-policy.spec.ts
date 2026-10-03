import {
  attachmentWindowMs,
  imageCleanupConfiguration,
  uploadSettlementHorizonMs,
} from './image-upload-policy';

const cleanupEnvironment = [
  'IMAGE_CLEANUP_INTERVAL_SECONDS',
  'IMAGE_CLEANUP_BATCH_SIZE',
  'IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET',
  'IMAGE_CLEANUP_LEASE_SECONDS',
  'IMAGE_CLEANUP_MAX_BACKOFF_SECONDS',
  'IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS',
  'IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS',
  'IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS',
] as const;
const savedEnvironment = new Map(
  cleanupEnvironment.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  for (const name of cleanupEnvironment) delete process.env[name];
});

afterAll(() => {
  for (const [name, value] of savedEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('image cleanup bounds', () => {
  it('caps the pending attachment window at the one-hour policy limit', () => {
    process.env.IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS = '3600';
    expect(attachmentWindowMs()).toBe(3_600_000);
    process.env.IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS = '3601';
    expect(() => attachmentWindowMs()).toThrow(
      'IMAGE_UPLOAD_ATTACHMENT_WINDOW_SECONDS is outside the supported range',
    );
  });

  it('defaults to two identities and a lease longer than one provider probe set', () => {
    expect(imageCleanupConfiguration()).toMatchObject({
      intervalMs: 300_000,
      batchSize: 20,
      providerRequestBudget: 18,
      leaseMs: 120_000,
      providerTimeoutMs: 5_000,
      maxBackoffMs: 86_400_000,
    });
  });

  it('rejects a request budget smaller than one full allocated-identity probe', () => {
    process.env.IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET = '8';
    expect(() => imageCleanupConfiguration()).toThrow(
      'IMAGE_CLEANUP_PROVIDER_REQUEST_BUDGET must be at least 9',
    );
  });

  it('rejects a lease that may expire before sequential provider probes finish', () => {
    process.env.IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS = '15000';
    process.env.IMAGE_CLEANUP_LEASE_SECONDS = '120';
    expect(() => imageCleanupConfiguration()).toThrow(
      'IMAGE_CLEANUP_LEASE_SECONDS must cover the bounded provider request sequence',
    );
  });

  it('allows the exact configured lease margin for the provider request bound', () => {
    process.env.IMAGE_CLEANUP_PROVIDER_TIMEOUT_MS = '15000';
    process.env.IMAGE_CLEANUP_LEASE_SECONDS = '140';
    expect(imageCleanupConfiguration().leaseMs).toBe(140_000);
  });

  it('keeps an in-flight verification settlement margin of at least one minute', () => {
    process.env.IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS = '59';
    expect(() => uploadSettlementHorizonMs()).toThrow(
      'IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS must be at least 60',
    );
    process.env.IMAGE_UPLOAD_SETTLEMENT_HORIZON_SECONDS = '60';
    expect(uploadSettlementHorizonMs()).toBe(60_000);
  });
});
