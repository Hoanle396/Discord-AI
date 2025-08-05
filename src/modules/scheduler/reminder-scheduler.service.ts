import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Reminder, ReminderFrequency } from '../health/entities/reminder.entity';
import { User } from '../health/entities/user.entity';
import { DiscordService } from '../discord/discord.service';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    @InjectRepository(Reminder)
    private reminderRepository: Repository<Reminder>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private discordService: DiscordService,
    private geminiService: GeminiService,
    private configService: ConfigService,
  ) {}

  // Check for reminders every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminderCheck() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      this.logger.debug(`Checking reminders for time: ${currentTime}`);

      const reminders = await this.reminderRepository.find({
        where: { 
          reminderTime: currentTime, 
          isActive: true 
        },
        relations: ['user'],
      });

      for (const reminder of reminders) {
        await this.sendReminder(reminder);
        
        // If it's not a recurring reminder, deactivate it
        if (reminder.frequency === 'once') {
          reminder.isActive = false;
          await this.reminderRepository.save(reminder);
        }
      }

      if (reminders.length > 0) {
        this.logger.log(`Processed ${reminders.length} reminders for ${currentTime}`);
      }
    } catch (error) {
      this.logger.error('Error checking reminders:', error);
    }
  }

  // Daily health check reminder at 9 AM
  @Cron('0 9 * * *')
  async sendDailyHealthCheck() {
    try {
      this.logger.log('Sending daily health check reminders');
      
      const reminderChannelId = this.configService.get<string>('REMINDER_CHANNEL_ID');
      if (!reminderChannelId) {
        this.logger.warn('No reminder channel configured for daily health checks');
        return;
      }

      const healthTips = [
        'Remember to drink water throughout the day! 💧',
        'Take a few minutes to stretch and move around! 🧘‍♀️',
        'Don\'t forget to take your medications if prescribed! 💊',
        'How are you feeling today? Consider logging your mood! 😊',
        'Remember to eat nutritious meals today! 🥗',
        'Take time for deep breathing exercises! 🫁',
        'Check your posture - sitting up straight? 🪑',
        'Step outside for some fresh air if possible! 🌳',
      ];

      const randomTip = healthTips[Math.floor(Math.random() * healthTips.length)];
      const aiTip = await this.geminiService.generateReminderMessage('daily health check');

      const message = `🌅 **Daily Health Check!**\n\n${randomTip}\n\n🤖 **AI Tip**: ${aiTip}\n\nUse \`!health record\` to log your health data today!`;

      await this.discordService.sendMessage(reminderChannelId, message);
    } catch (error) {
      this.logger.error('Error sending daily health check:', error);
    }
  }

  // Weekly health summary on Sundays at 6 PM
  @Cron('0 18 * * 0')
  async sendWeeklyHealthSummary() {
    try {
      this.logger.log('Sending weekly health summaries');
      
      const reminderChannelId = this.configService.get<string>('REMINDER_CHANNEL_ID');
      if (!reminderChannelId) {
        return;
      }

      const users = await this.userRepository.find({
        relations: ['healthRecords'],
      });

      let activeUsers = 0;
      for (const user of users) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recentRecords = user.healthRecords?.filter(
          record => record.recordedAt >= weekAgo
        ) || [];

        if (recentRecords.length > 0) {
          activeUsers++;
        }
      }

      const summary = `📊 **Weekly Health Summary**\n\n` +
                     `👥 Active users this week: ${activeUsers}\n` +
                     `📈 Total users: ${users.length}\n\n` +
                     `Keep up the great work tracking your health! 💪\n` +
                     `Remember to use \`!stats\` to see your personal progress.`;

      await this.discordService.sendMessage(reminderChannelId, summary);
    } catch (error) {
      this.logger.error('Error sending weekly summary:', error);
    }
  }

  // Monthly reminder to update emergency contacts
  @Cron('0 10 1 * *') // 1st day of each month at 10 AM
  async sendMonthlyEmergencyContactReminder() {
    try {
      this.logger.log('Sending monthly emergency contact reminder');
      
      const reminderChannelId = this.configService.get<string>('REMINDER_CHANNEL_ID');
      if (!reminderChannelId) {
        return;
      }

      const message = `🚨 **Monthly Health Check**\n\n` +
                     `It's a good time to review and update your emergency contacts!\n\n` +
                     `• Use \`!emergency list\` to view your current contacts\n` +
                     `• Use \`!emergency add\` to add new contacts\n` +
                     `• Verify phone numbers are still current\n\n` +
                     `Keeping your emergency information up-to-date is important for your safety! 🛡️`;

      await this.discordService.sendMessage(reminderChannelId, message);
    } catch (error) {
      this.logger.error('Error sending emergency contact reminder:', error);
    }
  }

  private async sendReminder(reminder: Reminder) {
    try {
      const client = this.discordService.getClient();
      const user = await client.users.fetch(reminder.user.discordId);
      
      if (!user) {
        this.logger.warn(`User not found: ${reminder.user.discordId}`);
        return;
      }

      // Generate AI-enhanced reminder message
      const aiMessage = await this.geminiService.generateReminderMessage(reminder.title);

      const embed = {
        color: 0xffa500,
        title: '⏰ Health Reminder',
        description: reminder.title,
        fields: [
          { name: '📝 Description', value: reminder.description || 'No additional details', inline: false },
          { name: '🤖 AI Motivation', value: aiMessage, inline: false },
          { name: '🕐 Time', value: new Date().toLocaleString(), inline: true },
          { name: '🔄 Type', value: reminder.frequency === 'daily' ? 'Daily' : reminder.frequency, inline: true },
        ],
        footer: {
          text: 'Take care of your health! Use !reminder list to manage your reminders.',
        },
      };

      await user.send({ embeds: [embed] });
      this.logger.log(`Sent reminder to ${reminder.user.username}: ${reminder.title}`);
    } catch (error) {
      this.logger.error(`Failed to send reminder to user ${reminder.user.discordId}:`, error);
    }
  }

  // Method to manually trigger a reminder check (useful for testing)
  async checkRemindersNow() {
    await this.handleReminderCheck();
  }

  // Method to get upcoming reminders for a user
  async getUpcomingReminders(userId: string): Promise<Reminder[]> {
    return this.reminderRepository.find({
      where: {
        user: { discordId: userId },
        isActive: true,
      },
      order: { reminderTime: 'ASC' },
    });
  }

  // Method to get reminder statistics
  async getReminderStats() {
    const totalReminders = await this.reminderRepository.count();
    const activeReminders = await this.reminderRepository.count({
      where: { isActive: true },
    });
    const recurringReminders = await this.reminderRepository.count({
      where: { isActive: true, frequency: ReminderFrequency.DAILY },
    });

    return {
      total: totalReminders,
      active: activeReminders,
      recurring: recurringReminders,
      oneTime: activeReminders - recurringReminders,
    };
  }
}
