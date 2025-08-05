import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { CommandHandler } from './command.handler';
import { GeminiModule } from '../gemini/gemini.module';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [GeminiModule, HealthModule],
  providers: [DiscordService, CommandHandler],
  exports: [DiscordService],
})
export class DiscordModule {}
