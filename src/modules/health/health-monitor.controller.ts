import { Controller, Get, Sse, Query, MessageEvent, Param } from '@nestjs/common';
import { Observable, interval, map, filter, switchMap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthRecord } from './entities/health-record.entity';
import { User } from './entities/user.entity';
import { Reminder } from './entities/reminder.entity';
import { GeminiService } from '../gemini/gemini.service';

interface HealthEvent {
  type: 'health_record' | 'reminder' | 'ai_insight' | 'alert';
  data: any;
  timestamp: string;
  userId?: string;
}

@ApiTags('Health Monitoring')
@Controller('health-monitor')
export class HealthMonitorController {
  constructor(
    @InjectRepository(HealthRecord)
    private healthRecordRepository: Repository<HealthRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Reminder)
    private reminderRepository: Repository<Reminder>,
    private geminiService: GeminiService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get health monitoring system status' })
  @ApiResponse({ status: 200, description: 'System status' })
  async getStatus() {
    const totalUsers = await this.userRepository.count();
    const totalRecords = await this.healthRecordRepository.count();
    const activeReminders = await this.reminderRepository.count({
      where: { isActive: true },
    });

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: {
        totalUsers,
        totalRecords,
        activeReminders,
      },
      uptime: process.uptime(),
    };
  }

  @Sse('events')
  @ApiOperation({ summary: 'Subscribe to real-time health events' })
  @ApiResponse({ status: 200, description: 'Server-sent events stream' })
  healthEvents(@Query('userId') userId?: string): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(async () => {
        const events: HealthEvent[] = [];

        // Get recent health records
        const recentRecords = await this.getRecentHealthRecords(userId);
        if (recentRecords.length > 0) {
          events.push({
            type: 'health_record',
            data: {
              count: recentRecords.length,
              latest: recentRecords[0],
              summary: this.summarizeHealthRecords(recentRecords),
            },
            timestamp: new Date().toISOString(),
            userId,
          });
        }

        // Check for upcoming reminders
        const upcomingReminders = await this.getUpcomingReminders(userId);
        if (upcomingReminders.length > 0) {
          events.push({
            type: 'reminder',
            data: {
              upcoming: upcomingReminders,
              nextReminder: upcomingReminders[0],
            },
            timestamp: new Date().toISOString(),
            userId,
          });
        }

        // Generate AI insights for recent data
        if (recentRecords.length > 0) {
          const insights = await this.generateAIInsights(recentRecords);
          events.push({
            type: 'ai_insight',
            data: {
              insights,
              basedOn: recentRecords.length,
            },
            timestamp: new Date().toISOString(),
            userId,
          });
        }

        return events;
      }),
      filter((events) => events.length > 0),
      map((events) => ({
        data: JSON.stringify(events),
        type: 'health-update',
      })),
    );
  }

  @Sse('user/:discordId/events')
  @ApiOperation({ summary: 'Subscribe to user-specific health events' })
  userHealthEvents(@Param('discordId') discordId: string): Observable<MessageEvent> {
    return interval(3000).pipe(
      switchMap(async () => {
        const user = await this.userRepository.findOne({
          where: { discordId },
          relations: ['healthRecords', 'reminders'],
        });

        if (!user) {
          return {
            type: 'error',
            data: { message: 'User not found' },
            timestamp: new Date().toISOString(),
          };
        }

        const events: HealthEvent[] = [];

        // Get user's recent health records
        const recentRecords = user.healthRecords
          ?.filter(record => {
            const recordDate = new Date(record.recordedAt);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return recordDate > oneDayAgo;
          })
          .slice(0, 5) || [];

        if (recentRecords.length > 0) {
          events.push({
            type: 'health_record',
            data: {
              user: user.username,
              records: recentRecords,
              todayCount: recentRecords.length,
            },
            timestamp: new Date().toISOString(),
            userId: user.discordId,
          });
        }

        // Check for alerts based on health data
        const alerts = await this.checkHealthAlerts(recentRecords);
        if (alerts.length > 0) {
          events.push({
            type: 'alert',
            data: {
              alerts,
              severity: this.calculateSeverity(alerts),
            },
            timestamp: new Date().toISOString(),
            userId: user.discordId,
          });
        }

        return events;
      }),
      filter((events) => Array.isArray(events) && events.length > 0),
      map((events) => ({
        data: JSON.stringify(events),
        type: 'user-health-update',
      })),
    );
  }

  @Sse('live-stats')
  @ApiOperation({ summary: 'Subscribe to live system statistics' })
  liveStats(): Observable<MessageEvent> {
    return interval(10000).pipe(
      switchMap(async () => {
        const stats = await this.getLiveStats();
        return {
          data: JSON.stringify(stats),
          type: 'stats-update',
        };
      }),
    );
  }

  @Get('insights/:discordId')
  @ApiOperation({ summary: 'Get AI-generated health insights for a user' })
  async getUserInsights(@Param('discordId') discordId: string) {
    const user = await this.userRepository.findOne({
      where: { discordId },
      relations: ['healthRecords'],
    });

    if (!user) {
      return { error: 'User not found' };
    }

    const recentRecords = user.healthRecords
      ?.filter(record => {
        const recordDate = new Date(record.recordedAt);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return recordDate > oneWeekAgo;
      }) || [];

    if (recentRecords.length === 0) {
      return {
        message: 'No recent health data available for insights',
        suggestion: 'Start tracking your health data to get personalized insights!',
      };
    }

    const insights = await this.generateDetailedInsights(recentRecords);
    const trends = this.analyzeTrends(recentRecords);

    return {
      user: user.username,
      insights,
      trends,
      dataPoints: recentRecords.length,
      period: '7 days',
      generatedAt: new Date().toISOString(),
    };
  }

  private async getRecentHealthRecords(userId?: string): Promise<HealthRecord[]> {
    const where: any = {};
    if (userId) {
      where.user = { discordId: userId };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return this.healthRecordRepository.find({
      where: {
        ...where,
        recordedAt: {
          $gte: oneHourAgo,
        } as any,
      },
      order: { recordedAt: 'DESC' },
      take: 10,
      relations: ['user'],
    });
  }

  private async getUpcomingReminders(userId?: string): Promise<Reminder[]> {
    const where: any = { isActive: true };
    if (userId) {
      where.user = { discordId: userId };
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return this.reminderRepository.find({
      where,
      order: { reminderTime: 'ASC' },
      take: 5,
      relations: ['user'],
    });
  }

  private summarizeHealthRecords(records: HealthRecord[]) {
    const types = [...new Set(records.map(r => r.type))];
    const byType = types.map(type => ({
      type,
      count: records.filter(r => r.type === type).length,
      latest: records.find(r => r.type === type),
    }));

    return {
      totalRecords: records.length,
      types: byType,
      timeRange: {
        from: records[records.length - 1]?.recordedAt,
        to: records[0]?.recordedAt,
      },
    };
  }

  private async generateAIInsights(records: HealthRecord[]): Promise<string> {
    try {
      const summary = this.summarizeHealthRecords(records);
      const prompt = `Analyze the following health data and provide a brief insight:
      
Records: ${records.length}
Types: ${summary.types.map(t => `${t.type}: ${t.count}`).join(', ')}
Latest entries: ${records.slice(0, 3).map(r => `${r.type}: ${r.data}`).join(', ')}

Provide a 2-3 sentence health insight focusing on patterns and recommendations.`;

      return await this.geminiService.generateResponse(prompt);
    } catch (error) {
      return 'Keep up the great work tracking your health data! Consistent monitoring helps maintain better health outcomes.';
    }
  }

  private async generateDetailedInsights(records: HealthRecord[]): Promise<string> {
    try {
      const analysis = this.analyzeTrends(records);
      const prompt = `Provide detailed health insights based on this week's data:

Data Summary:
${analysis.summary}

Trends:
${analysis.trends.map(t => `${t.type}: ${t.trend} (${t.description})`).join('\n')}

Provide comprehensive insights including:
1. Overall health patterns
2. Areas of improvement
3. Positive trends to continue
4. Actionable recommendations

Keep it encouraging and informative (300-400 words).`;

      return await this.geminiService.generateResponse(prompt);
    } catch (error) {
      return 'Your consistent health tracking shows great dedication to your wellness journey. Keep monitoring your health metrics for better insights over time.';
    }
  }

  private analyzeTrends(records: HealthRecord[]) {
    const typeGroups = records.reduce((acc, record) => {
      if (!acc[record.type]) acc[record.type] = [];
      acc[record.type].push(record);
      return acc;
    }, {} as Record<string, HealthRecord[]>);

    const trends = Object.entries(typeGroups).map(([type, typeRecords]) => {
      const sortedRecords = (typeRecords as any[]).sort((a, b) => 
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );

      let trend = 'stable';
      let description = 'No significant changes';

      if (sortedRecords.length >= 2) {
        const first = sortedRecords[0];
        const last = sortedRecords[sortedRecords.length - 1];
        
        // Simple trend analysis for numeric values
        const firstValue = parseFloat(first.value);
        const lastValue = parseFloat(last.value);
        
        if (!isNaN(firstValue) && !isNaN(lastValue)) {
          const change = ((lastValue - firstValue) / firstValue) * 100;
          if (change > 5) {
            trend = 'increasing';
            description = `${change.toFixed(1)}% increase`;
          } else if (change < -5) {
            trend = 'decreasing';
            description = `${Math.abs(change).toFixed(1)}% decrease`;
          }
        }
      }

      return {
        type,
        trend,
        description,
        count: (typeRecords as any[]).length,
        latest: sortedRecords[sortedRecords.length - 1],
      };
    });

    return {
      summary: `Analyzed ${records.length} health records across ${trends.length} categories`,
      trends,
      period: '7 days',
    };
  }

  private async checkHealthAlerts(records: HealthRecord[]): Promise<any[]> {
    const alerts = [];

    // Check for concerning patterns
    const bloodPressureRecords = records.filter(r => r.type === 'blood_pressure');
    const weightRecords = records.filter(r => r.type === 'weight');

    // Example alert for high blood pressure readings
    bloodPressureRecords.forEach(record => {
      const value = record.data.toLowerCase();
      if (value.includes('high') || value.includes('180') || value.includes('110')) {
        alerts.push({
          type: 'blood_pressure_high',
          message: 'High blood pressure reading detected',
          severity: 'high',
          recommendation: 'Consider consulting with a healthcare provider',
          recordId: record.id,
        });
      }
    });

    // Check for missed medications (if no medication records today)
    const today = new Date().toDateString();
    const todayMedications = records.filter(r => 
      r.type === 'medication' && 
      new Date(r.recordedAt).toDateString() === today
    );

    if (todayMedications.length === 0 && records.length > 0) {
      alerts.push({
        type: 'medication_reminder',
        message: 'No medication records found for today',
        severity: 'medium',
        recommendation: 'Don\'t forget to log your medications',
      });
    }

    return alerts;
  }

  private calculateSeverity(alerts: any[]): string {
    if (alerts.some(a => a.severity === 'high')) return 'high';
    if (alerts.some(a => a.severity === 'medium')) return 'medium';
    return 'low';
  }

  private async getLiveStats() {
    const totalUsers = await this.userRepository.count();
    const totalRecords = await this.healthRecordRepository.count();
    const activeReminders = await this.reminderRepository.count({
      where: { isActive: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = await this.healthRecordRepository.count({
      where: {
        recordedAt: {
          $gte: today,
        } as any,
      },
    });

    const activeUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.healthRecords', 'record')
      .where('record.recordedAt >= :today', { today })
      .getCount();

    return {
      timestamp: new Date().toISOString(),
      totals: {
        users: totalUsers,
        records: totalRecords,
        activeReminders,
      },
      today: {
        records: todayRecords,
        activeUsers,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };
  }
}
