import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 统一 API 前缀与版本：/api/v1/*
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3010';
  app.enableCors({
    origin: webOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const port = Number(process.env.BACKEND_PORT ?? 4010);
  await app.listen(port, '0.0.0.0');
  logger.log(`ZRH AI API listening on 0.0.0.0:${port} (prefix /api/v1)`);
}

void bootstrap();
