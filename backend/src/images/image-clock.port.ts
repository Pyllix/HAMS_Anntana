export const IMAGE_CLOCK = Symbol('IMAGE_CLOCK');

export interface ImageClock {
  now(): Date;
}
