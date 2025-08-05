import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { Reminder } from '../health/entities/reminder.entity';
import { User } from '../health/entities/user.entity';
import { DiscordModule } from '../discord/discord.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Reminder, User]),
    DiscordModule,
    GeminiModule,
  ],
  providers: [ReminderSchedulerService],
  exports: [ReminderSchedulerService],
})
export class SchedulerModule {}
