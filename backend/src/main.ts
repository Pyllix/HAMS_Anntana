import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { isTrustedOrigin } from './auth/csrf-protection';
import { sharedPrisma } from './common/config/database.config';

async function logAuthDatabaseVisibility() {
  if (process.env.AUTH_DB_DIAGNOSTICS !== '1') return;

  try {
    const [identity] = await sharedPrisma.$queryRaw<
      Array<{ database: string; schema: string }>
    >`SELECT current_database() AS database, current_schema() AS schema`;
    const adminExists = Boolean(
      await sharedPrisma.user.findUnique({
        where: { email: 'admin@hospital.go.th' },
        select: { id: true },
      }),
    );
    Logger.warn(
      `database=${identity.database} schema=${identity.schema} adminExists=${adminExists}`,
      'AuthDbDiagnostics',
    );
  } catch (error) {
    Logger.error(
      `Database visibility check failed (${error instanceof Error ? error.name : 'unknown error'})`,
      undefined,
      'AuthDbDiagnostics',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable body parsing to allow apiReference to handle it
  });

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS with explicit trusted origins
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (isTrustedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-User-Activity'],
  });

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด properties ที่ไม่อยู่ใน DTO ออก
      forbidNonWhitelisted: true, // throw error ถ้ามี unknown properties
      transform: true, // แปลง primitive types อัตโนมัติ
    }),
  );

  await logAuthDatabaseVisibility();

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HAMS API References')
    .setDescription('ระบบบริหารจัดการครุภัณฑ์หลังบ้าน')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Serve Swagger UI at /reference
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
