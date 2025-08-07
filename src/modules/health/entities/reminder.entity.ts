import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum ReminderType {
  MEDICATION = 'medication',
  APPOINTMENT = 'appointment',
  EXERCISE = 'exercise',
  VITALS_CHECK = 'vitals_check',
  WATER_INTAKE = 'water_intake',
  CUSTOM = 'custom',
}

export enum ReminderFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  type: string; // Using string instead of enum for SQLite compatibility

  @Column()
  frequency: string; // Using string instead of enum for SQLite compatibility

  @Column()
  reminderTime: string; // Format: HH:MM

  @Column({ type: 'text', nullable: true })
  customSchedule: string; // JSON stored as string for custom frequency patterns

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastSent: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.reminders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;
}
