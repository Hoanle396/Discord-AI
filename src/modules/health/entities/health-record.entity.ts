import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum HealthRecordType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  WEIGHT = 'weight',
  TEMPERATURE = 'temperature',
  BLOOD_SUGAR = 'blood_sugar',
  MEDICATION = 'medication',
  SYMPTOMS = 'symptoms',
  EXERCISE = 'exercise',
  SLEEP = 'sleep',
  MOOD = 'mood',
  BMI = 'bmi',
}

@Entity('health_records')
export class HealthRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string; // Using string instead of enum for SQLite compatibility

  @Column({ type: 'text' })
  data: string; // JSON stored as string

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  recordedAt: Date;

  @ManyToOne(() => User, user => user.healthRecords)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;
}
