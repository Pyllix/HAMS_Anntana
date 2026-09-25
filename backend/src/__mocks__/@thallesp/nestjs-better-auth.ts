import { Injectable, CanActivate, ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}

export const Session = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.session || { user: req.user };
});

export const Public = () => SetMetadata('isPublic', true);
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
