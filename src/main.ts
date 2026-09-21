//  $$$$$$\   $$$$$$\  $$$$$$$\  $$\       $$$$$$\ $$\   $$\ $$$$$$$$\      $$\      $$\  $$$$$$\  $$$$$$\ $$\   $$\
// $$  __$$\ $$  __$$\ $$  __$$\ $$ |      \_$$  _|$$$\  $$ |$$  _____|     $$$\    $$$ |$$  __$$\ \_$$  _|$$$\  $$ |
// $$ /  \__|$$ /  $$ |$$ |  $$ |$$ |        $$ |  $$$$\ $$ |$$ |           $$$$\  $$$$ |$$ /  $$ |  $$ |  $$$$\ $$ |
// $$ |      $$$$$$$$ |$$$$$$$  |$$ |        $$ |  $$ $$\$$ |$$$$$\ $$$$$$\ $$\$$\$$ $$ |$$$$$$$$ |  $$ |  $$ $$\$$ |
// $$ |      $$  __$$ |$$  __$$< $$ |        $$ |  $$ \$$$$ |$$  __|\______|$$ \$$$  $$ |$$  __$$ |  $$ |  $$ \$$$$ |
// $$ |  $$\ $$ |  $$ |$$ |  $$ |$$ |        $$ |  $$ |\$$$ |$$ |           $$ |\$  /$$ |$$ |  $$ |  $$ |  $$ |\$$$ |
// \$$$$$$  |$$ |  $$ |$$ |  $$ |$$$$$$$$\ $$$$$$\ $$ | \$$ |$$$$$$$$\      $$ | \_/ $$ |$$ |  $$ |$$$$$$\ $$ | \$$ |
//  \______/ \__|  \__|\__|  \__|\________|\______|\__|  \__|\________|     \__|     \__|\__|  \__|\______|\__|  \__|

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import morgan from 'morgan';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

import constants from './constants';
import { V2_SECTIONS, keepV2SectionsOnly } from './helpers/user-auth-swagger';
const { SWAGGER, Global } = constants;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // morgan for logging
  app.use(morgan('dev'));

  // Serve uploaded files statically
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: `${Global.PREFIX}/uploads`,
  });

  // Local booking test pages (user + driver side). Owner: Prakash Mishra
  app.useStaticAssets(join(__dirname, '..', 'test-client'), {
    prefix: `${Global.PREFIX}/test-client`,
  });

  // enable global validation for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  //  cors
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // WebSocket Adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global Prefix
  app.setGlobalPrefix(Global.PREFIX);

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle(SWAGGER.TITLE)
    .setDescription(SWAGGER.DESCRIPTION)
    .setVersion(SWAGGER.VERSION)
    .addServer(process.env.BASE_URL || SWAGGER.SERVER_URL || '/')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${Global.PREFIX}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Swagger v2 - only our own sections (user auth, user booking, driver booking).
  const v2Builder = new DocumentBuilder()
    .setTitle(SWAGGER.TITLE + ' - App APIs')
    .setDescription(
      'Our own APIs only - passenger auth + user booking + driver booking',
    )
    .setVersion(SWAGGER.VERSION)
    .addServer(process.env.BASE_URL || SWAGGER.SERVER_URL || '/')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    );

  V2_SECTIONS.forEach((section) => {
    v2Builder.addTag(section.name, section.description);
  });

  const documentV2 = keepV2SectionsOnly(
    SwaggerModule.createDocument(app, v2Builder.build()),
  );
  SwaggerModule.setup(Global.PREFIX + '/docs/v2', app, documentV2, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4016);
  console.log(`🚀 Carline main server is running on port ${process.env.PORT}`);
}
bootstrap();
