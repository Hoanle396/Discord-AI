import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../modules/health/entities/user.entity';
import { HealthRecord } from '../modules/health/entities/health-record.entity';
import { Reminder } from '../modules/health/entities/reminder.entity';
import { EmergencyContact } from '../modules/health/entities/emergency-contact.entity';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'sqlite',
      database: this.configService.get('DATABASE_PATH') || 'data/discord-health-bot.db',
      entities: [User, HealthRecord, Reminder, EmergencyContact],
      synchronize: this.configService.get('NODE_ENV') === 'development',
      logging: this.configService.get('NODE_ENV') === 'development',
    };
  }
}
