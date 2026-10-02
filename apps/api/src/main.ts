import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import { AppModule } from "./app.module";
import { browserOriginMiddleware } from "./common/browser-origin.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  (app.getHttpAdapter().getInstance() as Express).disable("x-powered-by");
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  app.enableCors({
    origin: new URL(frontendUrl).origin,
    credentials: true,
  });
  app.use(browserOriginMiddleware(frontendUrl));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

bootstrap();
