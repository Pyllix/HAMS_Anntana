import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable body parsing to allow apiReference to handle it
    });

    // Enable CORS for the React frontend
    app.enableCors({
    origin: process.env.FRONTEND_URL, // React frontend URL
    credentials: true,
    });

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // ตัด properties ที่ไม่อยู่ใน DTO ออก
      forbidNonWhitelisted: true, // throw error ถ้ามี unknown properties
      transform: true,       // แปลง primitive types อัตโนมัติ
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HAMS API References')
    .setDescription('ระบบบริหารจัดการครุภัณฑ์หลังบ้าน')
    .setVersion('1.0')
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
