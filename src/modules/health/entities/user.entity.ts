import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HealthRecord } from './health-record.entity';
import { Reminder } from './reminder.entity';
import { EmergencyContact } from './emergency-contact.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordId: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  preferences: string; // JSON stored as string

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => HealthRecord, healthRecord => healthRecord.user)
  healthRecords: HealthRecord[];

  @OneToMany(() => Reminder, reminder => reminder.user)
  reminders: Reminder[];

  @OneToMany(() => EmergencyContact, contact => contact.user)
  emergencyContacts: EmergencyContact[];
}
