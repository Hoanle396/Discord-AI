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

  @Column({
    type: 'enum',
    enum: HealthRecordType,
  })
  type: HealthRecordType;

  @Column({ type: 'json' })
  data: any;

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
