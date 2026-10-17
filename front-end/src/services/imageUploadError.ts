export class ImageUploadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ImageUploadError';
    this.code = code;
  }
}
