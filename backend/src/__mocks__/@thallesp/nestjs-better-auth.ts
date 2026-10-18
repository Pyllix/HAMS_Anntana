import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

export const Session = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      session?: unknown;
      user?: unknown;
    }>();
    return request.session || { user: request.user };
  },
);

export const Public = () => SetMetadata('isPublic', true);
export const AllowAnonymous = Public;
export const Optional = () => SetMetadata('isOptional', true);

export class AuthModule {
  static forRoot() {
    return {
      module: AuthModule,
      providers: [],
      exports: [],
    };
  }
}
