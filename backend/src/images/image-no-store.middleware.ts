import type { NextFunction, Request, Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';

@Injectable()
export class ImageNoStoreMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  }
}
