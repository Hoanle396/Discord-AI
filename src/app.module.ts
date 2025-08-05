import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscordModule } from './modules/discord/discord.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { DatabaseConfig } from './config/database.config';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    DiscordModule,
    GeminiModule,
    HealthModule,
    SchedulerModule,
  ],
})
export class AppModule {}
