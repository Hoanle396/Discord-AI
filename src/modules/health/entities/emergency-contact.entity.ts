import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('emergency_contacts')
export class EmergencyContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  relationship: string;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: false })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.emergencyContacts)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;
}
