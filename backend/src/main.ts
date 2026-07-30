import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3010';
  app.enableCors({
    origin: webOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const port = Number(process.env.BACKEND_PORT ?? 4010);
  await app.listen(port, '0.0.0.0');
  logger.log(`ZRH AI API listening on 0.0.0.0:${port} (prefix /api)`);
}

void bootstrap();
