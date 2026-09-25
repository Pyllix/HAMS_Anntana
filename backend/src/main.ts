import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable body parsing to allow apiReference to handle it
  });

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS with explicit trusted origins
  const trustedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (trustedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-User-Activity'],
  });

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด properties ที่ไม่อยู่ใน DTO ออก
      forbidNonWhitelisted: true, // throw error ถ้ามี unknown properties
      transform: true, // แปลง primitive types อัตโนมัติ
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HAMS API References')
    .setDescription('ระบบบริหารจัดการครุภัณฑ์หลังบ้าน')
    .setVersion('1.0')
    .addBearerAuth() // Enable Bearer token input in Scalar/Swagger UI
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
