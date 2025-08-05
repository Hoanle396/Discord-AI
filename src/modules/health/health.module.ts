import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { HealthRecord } from './entities/health-record.entity';
import { Reminder } from './entities/reminder.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { HealthMonitorController } from './health-monitor.controller';
import { HealthGateway } from './health.gateway';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, HealthRecord, Reminder, EmergencyContact]),
    GeminiModule,
  ],
  controllers: [HealthMonitorController],
  providers: [HealthGateway],
  exports: [TypeOrmModule, HealthGateway],
})
export class HealthModule {}
