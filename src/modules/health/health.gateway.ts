import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { HealthRecord, HealthRecordType } from './entities/health-record.entity';
import { Reminder } from './entities/reminder.entity';
import { GeminiService } from '../gemini/gemini.service';

interface HealthSocketData {
  userId: string;
  discordId: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/health',
})
export class HealthGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HealthGateway.name);
  private connectedUsers = new Map<string, HealthSocketData>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HealthRecord)
    private healthRecordRepository: Repository<HealthRecord>,
    @InjectRepository(Reminder)
    private reminderRepository: Repository<Reminder>,
    private geminiService: GeminiService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Send connection confirmation
    client.emit('connection-confirmed', {
      message: 'Connected to Health Monitoring System',
      timestamp: new Date().toISOString(),
      clientId: client.id,
    });

    // Send initial system stats
    const stats = await this.getSystemStats();
    client.emit('system-stats', stats);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedUsers.delete(client.id);
  }

  @SubscribeMessage('join-user-room')
  async handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { discordId: string; username?: string }
  ) {
    const user = await this.userRepository.findOne({
      where: { discordId: data.discordId },
      relations: ['healthRecords', 'reminders'],
    });

    if (!user) {
      client.emit('error', {
        message: 'User not found',
        discordId: data.discordId,
      });
      return;
    }

    // Store user data for this connection
    this.connectedUsers.set(client.id, {
      userId: user.id.toString(),
      discordId: data.discordId,
    });

    // Join user-specific room
    const roomName = `user-${data.discordId}`;
    await client.join(roomName);

    client.emit('joined-room', {
      room: roomName,
      user: {
        username: user.username,
        discordId: user.discordId,
        memberSince: user.createdAt,
      },
    });

    // Send user's recent health data
    await this.sendUserHealthSummary(client, user);

    this.logger.log(`User ${user.username} joined room: ${roomName}`);
  }

  @SubscribeMessage('get-health-insights')
  async handleGetHealthInsights(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { discordId: string; days?: number }
  ) {
    const days = data.days || 7;
    const user = await this.userRepository.findOne({
      where: { discordId: data.discordId },
      relations: ['healthRecords'],
    });

    if (!user) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentRecords = user.healthRecords?.filter(
      record => new Date(record.recordedAt) > daysAgo
    ) || [];

    if (recentRecords.length === 0) {
      client.emit('health-insights', {
        message: 'No recent health data available',
        suggestion: 'Start tracking your health to get insights!',
      });
      return;
    }

    try {
      const insights = await this.generateHealthInsights(recentRecords, days);
      const trends = this.analyzeHealthTrends(recentRecords);

      client.emit('health-insights', {
        insights,
        trends,
        period: `${days} days`,
        dataPoints: recentRecords.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error generating health insights:', error);
      client.emit('error', { message: 'Failed to generate insights' });
    }
  }

  @SubscribeMessage('subscribe-live-updates')
  async handleSubscribeLiveUpdates(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { discordId?: string; interval?: number }
  ) {
    const interval = data.interval || 30000; // Default 30 seconds
    
    client.emit('subscription-confirmed', {
      type: 'live-updates',
      interval,
      discordId: data.discordId,
    });

    // Set up periodic updates
    const updateInterval = setInterval(async () => {
      try {
        if (data.discordId) {
          await this.sendUserLiveUpdate(client, data.discordId);
        } else {
          await this.sendSystemLiveUpdate(client);
        }
      } catch (error) {
        this.logger.error('Error sending live update:', error);
      }
    }, interval);

    // Store interval for cleanup
    client.data.updateInterval = updateInterval;

    // Cleanup on disconnect
    client.on('disconnect', () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    });
  }

  @SubscribeMessage('health-record-added')
  async handleHealthRecordAdded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      discordId: string;
      type: HealthRecordType;
      value: string;
      notes?: string;
    }
  ) {
    const user = await this.userRepository.findOne({
      where: { discordId: data.discordId },
    });

    if (!user) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    // Create new health record
    const healthRecord = this.healthRecordRepository.create({
      user: user,
      type: data.type,
      data:data.value,
      notes: data.notes || '',
      recordedAt: new Date(),
    });

    await this.healthRecordRepository.save(healthRecord);

    // Generate AI advice
    const aiAdvice = await this.geminiService.generateHealthAdvice({
      type: data.type,
      value: data.value,
      notes: data.notes,
    });

    // Emit to user's room
    this.server.to(`user-${data.discordId}`).emit('health-record-saved', {
      record: {
        id: healthRecord.id,
        type: healthRecord.type,
        value: healthRecord.data,
        notes: healthRecord.notes,
        recordedAt: healthRecord.recordedAt,
      },
      aiAdvice,
      timestamp: new Date().toISOString(),
    });

    // Emit to all connected clients for system updates
    this.server.emit('system-activity', {
      type: 'health-record-added',
      user: user.username,
      recordType: data.type,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Health record added for user ${user.username}: ${data.type}`);
  }

  @SubscribeMessage('request-ai-chat')
  async handleAiChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string; discordId: string }
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { discordId: data.discordId },
        relations: ['healthRecords'],
      });

      let userContext = '';
      if (user) {
        const recentRecords = user.healthRecords
          ?.slice(0, 5)
          .map(r => `${r.type}: ${r.data}`)
          .join(', ') || 'No recent health data';
        
        userContext = `User: ${user.username}, Recent health data: ${recentRecords}`;
      }

      const response = await this.geminiService.generateResponse(
        `${userContext}\n\nUser question: ${data.message}`
      );

      client.emit('ai-response', {
        response,
        timestamp: new Date().toISOString(),
        conversationId: `${client.id}-${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Error in AI chat:', error);
      client.emit('error', { message: 'Failed to get AI response' });
    }
  }

  // Broadcast methods for system-wide events
  async broadcastReminderAlert(reminder: Reminder) {
    this.server.to(`user-${reminder.user.discordId}`).emit('reminder-alert', {
      reminder: {
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        time: reminder.reminderTime,
        type: reminder.type,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastHealthAlert(discordId: string, alert: any) {
    this.server.to(`user-${discordId}`).emit('health-alert', {
      alert,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastSystemMaintenance(message: string) {
    this.server.emit('system-maintenance', {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendUserHealthSummary(client: Socket, user: User) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = user.healthRecords?.filter(
      record => new Date(record.recordedAt) >= today
    ) || [];

    const activeReminders = user.reminders?.filter(r => r.isActive) || [];

    client.emit('user-health-summary', {
      user: {
        username: user.username,
        memberSince: user.createdAt,
      },
      today: {
        recordsCount: todayRecords.length,
        records: todayRecords.slice(0, 5),
      },
      reminders: {
        active: activeReminders.length,
        upcoming: activeReminders.slice(0, 3),
      },
      timestamp: new Date().toISOString(),
    });
  }

  private async sendUserLiveUpdate(client: Socket, discordId: string) {
    const user = await this.userRepository.findOne({
      where: { discordId },
      relations: ['healthRecords', 'reminders'],
    });

    if (!user) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentActivity = user.healthRecords?.filter(
      record => new Date(record.recordedAt) > oneHourAgo
    ) || [];

    client.emit('user-live-update', {
      recentActivity: recentActivity.length,
      lastActivity: recentActivity[0]?.recordedAt,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendSystemLiveUpdate(client: Socket) {
    const stats = await this.getSystemStats();
    client.emit('system-live-update', stats);
  }

  private async getSystemStats() {
    const totalUsers = await this.userRepository.count();
    const totalRecords = await this.healthRecordRepository.count();
    const activeReminders = await this.reminderRepository.count({
      where: { isActive: true },
    });

    return {
      totalUsers,
      totalRecords,
      activeReminders,
      timestamp: new Date().toISOString(),
    };
  }

  private async generateHealthInsights(records: HealthRecord[], days: number) {
    const summary = this.summarizeRecords(records);
    const prompt = `Analyze health data from the last ${days} days:

${summary}

Provide insights about:
1. Health patterns and trends
2. Areas for improvement
3. Positive developments
4. Recommendations for better health

Keep it encouraging and actionable (200-300 words).`;

    return await this.geminiService.generateResponse(prompt);
  }

  private analyzeHealthTrends(records: HealthRecord[]) {
    const typeGroups = records.reduce((acc, record) => {
      if (!acc[record.type]) acc[record.type] = [];
      acc[record.type].push(record);
      return acc;
    }, {} as Record<string, HealthRecord[]>);

    return Object.entries(typeGroups).map(([type, typeRecords]) => {
      const sortedRecords = typeRecords.sort((a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );

      return {
        type,
        count: typeRecords.length,
        trend: this.calculateTrend(sortedRecords),
        latest: sortedRecords[sortedRecords.length - 1],
        earliest: sortedRecords[0],
      };
    });
  }

  private calculateTrend(records: HealthRecord[]) {
    if (records.length < 2) return 'insufficient_data';

    const first = records[0];
    const last = records[records.length - 1];

    const firstValue = parseFloat(first.data);
    const lastValue = parseFloat(last.data);

    if (isNaN(firstValue) || isNaN(lastValue)) {
      return 'non_numeric';
    }

    const change = ((lastValue - firstValue) / firstValue) * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  private summarizeRecords(records: HealthRecord[]) {
    const types = [...new Set(records.map(r => r.type))];
    const summary = types.map(type => {
      const typeRecords = records.filter(r => r.type === type);
      return `${type}: ${typeRecords.length} entries`;
    }).join(', ');

    return `Total records: ${records.length}. Types: ${summary}`;
  }
}
