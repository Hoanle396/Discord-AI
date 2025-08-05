import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001', 'https://your-frontend-domain.com'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
      credentials: true,
    },
  });

  const logger = new Logger('Bootstrap');

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Discord Health Bot API')
    .setDescription('API for Discord Health Bot with real-time monitoring, AI insights, and health tracking')
    .setVersion('1.0')
    .addTag('health-monitoring', 'Health monitoring and tracking endpoints')
    .addTag('real-time', 'WebSocket and SSE endpoints')
    .addTag('ai-insights', 'AI-powered health insights')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Set up Server-Sent Events headers
  app.use('/health-monitor/events', (req, res, next) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    next();
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🤖 Discord Health Bot is running on port ${port}`);
  logger.log(`🏥 Health care features initialized`);
  logger.log(`🧠 Gemini AI integration ready`);
  logger.log(`📊 Health monitoring dashboard: http://localhost:${port}/api/docs`);
  logger.log(`🔴 Real-time events: http://localhost:${port}/health-monitor/events`);
  logger.log(`⚡ WebSocket endpoint: ws://localhost:${port}/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});
