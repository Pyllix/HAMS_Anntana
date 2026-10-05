import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageAttachmentFields,
  createImageSaveAttempt,
  clearEmployeePhotoGrantCache,
  getEmployeePhotoBlob,
  ImageSaveOutcomeUnknownError,
  fetchEmployeePhotoBlobFromGrant,
  saveImageAwareForm,
  saveWithImageRecovery,
  uploadAndVerifyImage,
  validateImageSource,
} from "../src/services/imageUploadService";

const cloudinaryUrl = "https://api.cloudinary.com/v1_1/test-cloud/image/upload";

function makeFile(
  name = "portrait.heif",
  type = "image/heif",
  size = 128,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

test("accepts the backend HEIC/HEIF contract and rejects oversized source before API calls", () => {
  assert.equal(validateImageSource(makeFile("portrait.heic", "image/heic")).contentType, "image/heic");
  assert.equal(validateImageSource(makeFile("portrait.heif", "application/octet-stream")).contentType, "image/heif");
  assert.throws(
    () => validateImageSource(makeFile("large.jpg", "image/jpeg", 10_000_001)),
    { code: "SOURCE_SIZE_LIMIT" },
  );
  assert.throws(
    () => validateImageSource(makeFile("fake.jpg", "image/gif")),
    { code: "SOURCE_TYPE_NOT_ALLOWED" },
  );
});

test("uploads directly using every backend instruction, verifies, then returns a normalized pending preview", async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const api = {
    async post(path: string, body?: unknown) {
      calls.push({ method: "POST", path, body });
      if (path === "/images/uploads") {
        return { data: {
          uploadId: "upload-1",
          purpose: "ASSET_IMAGE",
          creationContextToken: "create-context",
          attachmentWindowSeconds: 3600,
          acceptedSourceMimeTypes: ["image/heif"],
          uploadInstructions: {
            url: cloudinaryUrl,
            method: "POST",
            fields: {
              api_key: "public-key",
              public_id: "hams-asset-image-id",
              signature: "temporary-signature",
              transformation: "signed-by-server",
            },
          },
        } };
      }
      assert.equal(path, "/images/uploads/upload-1/complete");
      return { data: { status: "VERIFIED_PENDING", attachmentExpiresAt: "2099-01-01T00:00:00.000Z" } };
    },
    async get(path: string) {
      calls.push({ method: "GET", path });
      return { data: { purpose: "ASSET_IMAGE", status: "VERIFIED_PENDING", url: "https://res.cloudinary.com/test/image/upload/v1/asset.jpg" } };
    },
  };
  let directRequest: RequestInit | undefined;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    directRequest = init;
    const form = init?.body as FormData;
    assert.equal(form.get("api_key"), "public-key");
    assert.equal(form.get("public_id"), "hams-asset-image-id");
    assert.equal(form.get("transformation"), "signed-by-server");
    assert.equal(form.get("file") instanceof File, true);
    return new Response(JSON.stringify({
      public_id: "hams-asset-image-id",
      version: 17,
      signature: "response-signature",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await uploadAndVerifyImage(makeFile(), "ASSET_IMAGE", undefined, {
    api: api as never,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.uploadId, "upload-1");
  assert.equal(result.creationContextToken, "create-context");
  assert.match(result.previewUrl ?? "", /^https:\/\/res\.cloudinary\.com\//);
  assert.equal(directRequest?.credentials, "omit");
  assert.equal(directRequest?.cache, "no-store");
  assert.equal((directRequest?.headers as Record<string, string>)?.["Content-Type"], undefined);
  assert.deepEqual(calls.map(({ method, path }) => `${method} ${path}`), [
    "POST /images/uploads",
    "POST /images/uploads/upload-1/complete",
    "GET /images/uploads/upload-1/preview",
  ]);
  assert.deepEqual(calls[0].body, {
    purpose: "ASSET_IMAGE",
    sourceContentType: "image/heif",
    sourceSizeBytes: 128,
  });
  assert.deepEqual(calls[1].body, {
    publicId: "hams-asset-image-id",
    version: 17,
    signature: "response-signature",
  });
});

test("Employee Photo bytes use no-store, no credentials, URL/status/type checks, and no direct URL fallback", async () => {
  let request: RequestInit | undefined;
  const blob = new Blob(["synthetic image"], { type: "image/jpeg" });
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(blob, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };
  const result = await fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: fetchImpl as typeof fetch });
  assert.equal(result?.type, "image/jpeg");
  assert.equal(request?.cache, "no-store");
  assert.equal(request?.credentials, "omit");
  assert.equal((request?.headers as Record<string, string>)?.["Cache-Control"], "no-store");

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://example.invalid/photo.jpg",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: fetchImpl as typeof fetch }), { code: "IMAGE_URL_NOT_ALLOWED" });

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: (async () => { throw new TypeError("CORS"); }) as typeof fetch }), {
    code: "IMAGE_READ_UNAVAILABLE",
  });

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: (async () => new Response("denied", { status: 403 })) as typeof fetch }), {
    code: "IMAGE_READ_UNAVAILABLE",
  });

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: (async () => new Response("not an image", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })) as typeof fetch }), { code: "IMAGE_CONTENT_TYPE_INVALID" });

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: (async () => new Response("not normalized", {
    status: 200,
    headers: { "Content-Type": "image/png" },
  })) as typeof fetch }), { code: "IMAGE_CONTENT_TYPE_INVALID" });

  await assert.rejects(() => fetchEmployeePhotoBlobFromGrant({
    hasEmployeePhoto: true,
    url: "https://user@api.cloudinary.com/v1_1/test-cloud/image/download/signed",
    expiresAt: "2099-01-01T00:00:00.000Z",
  }, { fetchImpl: fetchImpl as typeof fetch }), { code: "IMAGE_URL_NOT_ALLOWED" });
});

test("current Employee Photo grant uses the authenticated HAMS route before direct no-store byte fetch", async () => {
  let hamsPath = "";
  let hamsHeaders: Record<string, string> | undefined;
  const blob = new Blob(["synthetic photo"], { type: "image/jpeg" });
  const api = {
    async get(path: string, config?: { headers?: Record<string, string> }) {
      hamsPath = path;
      hamsHeaders = config?.headers;
      return { data: {
        hasEmployeePhoto: true,
        photoRevision: "revision-1",
        url: "https://api.cloudinary.com/v1_1/test-cloud/image/download/signed",
        expiresAt: "2099-01-01T00:00:00.000Z",
      } };
    },
  };
  const result = await getEmployeePhotoBlob("employee-1", {
    api: api as never,
    fetchImpl: (async () => new Response(blob, {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    })) as typeof fetch,
  });
  assert.equal(hamsPath, "/users/employee-1/photo");
  assert.equal(hamsHeaders?.["Cache-Control"], "no-store");
  assert.equal(result?.type, "image/jpeg");
});

test("reuses Employee Photo grants only for the same account/revision and refreshes expired grants", async () => {
  clearEmployeePhotoGrantCache();
  let now = Date.parse("2026-10-04T00:00:00.000Z");
  let grantRequests = 0;
  let requestedRevision = "revision-1";
  const api = {
    async get() {
      grantRequests += 1;
      return { data: {
        hasEmployeePhoto: true,
        photoRevision: requestedRevision,
        url: `https://api.cloudinary.com/v1_1/test-cloud/image/download/grant-${grantRequests}`,
        expiresAt: new Date(now + 5_000).toISOString(),
      } };
    },
  };
  const fetchImpl = async () => new Response(new Blob(["synthetic photo"], {
    type: "image/jpeg",
  }), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  const read = (accountId: string, photoRevision: string) => getEmployeePhotoBlob("employee-1", {
    accountId,
    photoRevision,
    api: api as never,
    fetchImpl: fetchImpl as typeof fetch,
    now: () => now,
  });

  await read("admin-1", "revision-1");
  await read("admin-1", "revision-1");
  assert.equal(grantRequests, 1, "the same viewer and revision reuse a live grant");

  await read("admin-2", "revision-1");
  assert.equal(grantRequests, 2, "another signed-in account receives its own grant");

  requestedRevision = "revision-2";
  await read("admin-1", "revision-2");
  assert.equal(grantRequests, 3, "a replacement revision does not reuse the old grant");

  now += 5_001;
  await read("admin-1", "revision-2");
  assert.equal(grantRequests, 4, "an expired grant is refreshed only when a new read is requested");
  clearEmployeePhotoGrantCache();
});

test("asset and user write builders omit legacy imageUrl and add only a ready upload reference", () => {
  const created = buildImageAttachmentFields({
    imageUrl: "legacy-data-url",
    name: "synthetic asset",
  }, {
    uploadId: "upload-1",
    creationContextToken: "create-context",
  }, true);
  assert.deepEqual(created, {
    name: "synthetic asset",
    imageUploadId: "upload-1",
    imageCreationContextToken: "create-context",
  });

  const edited = buildImageAttachmentFields({ name: "changed metadata" }, {
    uploadId: "upload-2",
    creationContextToken: null,
  }, false);
  assert.deepEqual(edited, { name: "changed metadata", imageUploadId: "upload-2" });
  assert.deepEqual(buildImageAttachmentFields({ imageUrl: "old-url", name: "metadata" }, null, false), {
    name: "metadata",
  });
});

test("Asset create form sends its verified reference without the old imageUrl", async () => {
  let sent: Record<string, unknown> | undefined;
  const saved = await saveImageAwareForm({
    creating: true,
    payload: { name: "synthetic asset", imageUrl: "stale-data-url" },
    upload: { uploadId: "asset-upload", creationContextToken: "asset-context" },
    create: async (payload) => { sent = payload; return { id: "asset-1" }; },
    update: async () => { throw new Error("unexpected update"); },
    loadRecord: async () => null,
  });
  assert.deepEqual(saved, { id: "asset-1" });
  assert.deepEqual(sent, {
    name: "synthetic asset",
    imageUploadId: "asset-upload",
    imageCreationContextToken: "asset-context",
  });
});

test("User create form uses the pre-target creation context in the create API payload", async () => {
  let sent: Record<string, unknown> | undefined;
  await saveImageAwareForm({
    creating: true,
    payload: { email: "synthetic@example.test", firstname: "Synthetic" },
    upload: { uploadId: "employee-create-upload", creationContextToken: "employee-context" },
    create: async (payload) => { sent = payload; return { id: "user-1" }; },
    update: async () => { throw new Error("unexpected update"); },
    loadRecord: async () => null,
  });
  assert.deepEqual(sent, {
    email: "synthetic@example.test",
    firstname: "Synthetic",
    imageUploadId: "employee-create-upload",
    imageCreationContextToken: "employee-context",
  });
});

test("User edit form claims only a target-bound upload and leaves metadata-only saves image-neutral", async () => {
  const sent: Array<{ id: string; payload: Record<string, unknown> }> = [];
  await saveImageAwareForm({
    creating: false,
    targetId: "user-1",
    payload: { firstname: "Synthetic", imageUrl: "stale-public-url" },
    upload: { uploadId: "employee-upload", creationContextToken: null },
    create: async () => { throw new Error("unexpected create"); },
    update: async (id, payload) => { sent.push({ id, payload }); return { id }; },
    loadRecord: async () => null,
  });
  await saveImageAwareForm({
    creating: false,
    targetId: "user-1",
    payload: { firstname: "Metadata only", imageUrl: "stale-public-url" },
    upload: null,
    create: async () => { throw new Error("unexpected create"); },
    update: async (id, payload) => { sent.push({ id, payload }); return { id }; },
    loadRecord: async () => null,
  });

  assert.deepEqual(sent, [
    { id: "user-1", payload: { firstname: "Synthetic", imageUploadId: "employee-upload" } },
    { id: "user-1", payload: { firstname: "Metadata only" } },
  ]);
});

test("an uncertain metadata-only create is surfaced without automatic resubmission", async () => {
  let createCalls = 0;
  await assert.rejects(() => saveImageAwareForm({
    creating: true,
    payload: { email: "synthetic@example.test" },
    upload: null,
    create: async () => { createCalls += 1; throw new TypeError("network disconnected"); },
    update: async () => { throw new Error("unexpected update"); },
    loadRecord: async () => null,
  }), ImageSaveOutcomeUnknownError);
  assert.equal(createCalls, 1);
});

test("recovers a lost create response from a claimed upload without sending a duplicate create", async () => {
  let saveCalls = 0;
  const recoveredRecord = { id: "created-record", imageUrl: "server-derived" };
  const result = await saveWithImageRecovery({
    uploadId: "upload-1",
    api: { get: async () => ({ data: { status: "CLAIMED", claimedTargetId: "created-record" } }) } as never,
    save: async () => { saveCalls += 1; throw new TypeError("network disconnected"); },
    loadRecord: async (id: string) => id === "created-record" ? recoveredRecord : null,
  });
  assert.equal(result, recoveredRecord);
  assert.equal(saveCalls, 1);
});

test("retries the same verified pending claim once when the first save outcome was not committed", async () => {
  let saveCalls = 0;
  const result = await saveWithImageRecovery({
    uploadId: "upload-1",
    api: { get: async () => ({ data: { status: "VERIFIED_PENDING" } }) } as never,
    save: async () => {
      saveCalls += 1;
      if (saveCalls === 1) throw new TypeError("network disconnected");
      return { id: "saved-on-retry" };
    },
    loadRecord: async () => null,
  });
  assert.deepEqual(result, { id: "saved-on-retry" });
  assert.equal(saveCalls, 2);
});


test("manual recovery reuses the original pending upload and payload without uploading again", async () => {
  let available = false;
  const sent: Record<string, unknown>[] = [];
  const events: string[] = [];
  const payload = { name: "Original", nested: { value: "original" } };
  const upload = { uploadId: "upload-original", creationContextToken: null };
  const attempt = createImageSaveAttempt({
    creating: false, targetId: "asset-1", payload, upload,
    create: async () => { throw new Error("unexpected create"); },
    update: async (_id, body) => {
      events.push("save"); sent.push(body);
      if (!available) throw { response: { status: 503 } };
      return { id: "asset-1" };
    },
    loadRecord: async () => null,
    api: { get: async () => { events.push("status"); return { data: { status: "VERIFIED_PENDING" } }; } } as never,
  });
  await assert.rejects(attempt.save, ImageSaveOutcomeUnknownError);
  assert.equal(sent.length, 2);
  payload.name = "Changed after failure";
  payload.nested.value = "changed";
  upload.uploadId = "different-upload";
  available = true;
  events.length = 0;
  assert.deepEqual(await attempt.recover(), { id: "asset-1" });
  assert.deepEqual(events, ["status", "save"]);
  assert.deepEqual(sent[2], { name: "Original", nested: { value: "original" }, imageUploadId: "upload-original" });
});

test("manual recovery loads an already claimed result without creating a duplicate", async () => {
  let readable = false;
  let creates = 0;
  const attempt = createImageSaveAttempt({
    creating: true, payload: { name: "Original" }, upload: { uploadId: "upload-1", creationContextToken: "context-1" },
    create: async () => { creates += 1; throw new TypeError("response lost"); },
    update: async () => { throw new Error("unexpected update"); },
    loadRecord: async (id) => ({ id }),
    api: { get: async () => { if (!readable) throw new TypeError("offline"); return { data: { status: "CLAIMED", claimedTargetId: "created-1" } }; } } as never,
  });
  await assert.rejects(attempt.save, ImageSaveOutcomeUnknownError);
  readable = true;
  assert.deepEqual(await attempt.recover(), { id: "created-1" });
  assert.equal(creates, 1);
});

test("manual recovery stays uncertain while status is unavailable and never blindly resubmits", async () => {
  let writes = 0;
  const attempt = createImageSaveAttempt({
    creating: false, targetId: "asset-1", payload: {}, upload: { uploadId: "upload-1", creationContextToken: null },
    create: async () => { throw new Error("unexpected create"); },
    update: async () => { writes += 1; throw new TypeError("offline"); },
    loadRecord: async () => null,
    api: { get: async () => { throw new TypeError("offline"); } } as never,
  });
  await assert.rejects(attempt.save, ImageSaveOutcomeUnknownError);
  await assert.rejects(attempt.recover, ImageSaveOutcomeUnknownError);
  assert.equal(writes, 1);
});

test("manual recovery rejects expired uploads without extending their lifetime or resending", async () => {
  let writes = 0;
  const attempt = createImageSaveAttempt({
    creating: false, targetId: "asset-1", payload: {}, upload: { uploadId: "upload-1", creationContextToken: null },
    create: async () => { throw new Error("unexpected create"); },
    update: async () => { writes += 1; return { id: "asset-1" }; },
    loadRecord: async () => null,
    api: { get: async () => ({ data: { status: "EXPIRED" } }) } as never,
  });
  await assert.rejects(attempt.recover, { code: "UPLOAD_EXPIRED" });
  assert.equal(writes, 0);
});

test("an uncertain create without an upload has no automatic or manual duplicate submission", async () => {
  let creates = 0;
  const attempt = createImageSaveAttempt({
    creating: true, payload: { email: "synthetic@example.test" }, upload: null,
    create: async () => { creates += 1; throw new TypeError("response lost"); },
    update: async () => { throw new Error("unexpected update"); },
    loadRecord: async () => null,
  });
  assert.equal(attempt.hasUpload, false);
  await assert.rejects(attempt.save, ImageSaveOutcomeUnknownError);
  await assert.rejects(attempt.recover, ImageSaveOutcomeUnknownError);
  assert.equal(creates, 1);
});
