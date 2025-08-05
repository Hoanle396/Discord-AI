import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { User } from '../health/entities/user.entity';
import { HealthRecord, HealthRecordType } from '../health/entities/health-record.entity';
import { Reminder, ReminderType } from '../health/entities/reminder.entity';
import { EmergencyContact } from '../health/entities/emergency-contact.entity';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private configService: ConfigService,
    private geminiService: GeminiService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HealthRecord)
    private healthRecordRepository: Repository<HealthRecord>,
    @InjectRepository(Reminder)
    private reminderRepository: Repository<Reminder>,
    @InjectRepository(EmergencyContact)
    private emergencyContactRepository: Repository<EmergencyContact>,
  ) {}

  async handleCommand(message: Message) {
    const prefix = this.configService.get('BOT_PREFIX', '!');
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // Ensure user exists
    const user = await this.ensureUserExists(message.author.id, message.author.username);

    try {
      switch (command) {
        case 'ping':
          await message.reply('Pong! 🏓 Bot is healthy and running!');
          break;
        case 'health':
          await this.handleHealthCommand(message, args, user);
          break;
        case 'reminder':
          await this.handleReminderCommand(message, args, user);
          break;
        case 'emergency':
          await this.handleEmergencyCommand(message, args, user);
          break;
        case 'stats':
          await this.handleStatsCommand(message, user);
          break;
        case 'help':
          await this.sendHelpMessage(message);
          break;
        default:
          await message.reply('Unknown command. Type `!help` for available commands.');
      }
    } catch (error) {
      this.logger.error('Error handling command:', error);
      await message.reply('Sorry, there was an error processing your command. Please try again.');
    }
  }

  async handleMention(message: Message) {
    try {
      // Show typing indicator

      const user = await this.ensureUserExists(message.author.id, message.author.username);
      
      // Add health context for AI
      const healthContext = `User: ${user.username}\n`;
      const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
      const prompt = `${healthContext}Health Bot Context: You are a helpful health care assistant. Respond to health-related questions, provide general wellness advice, and help with health tracking. Always remind users to consult healthcare professionals for serious concerns.\n\nUser Message: ${cleanMessage}`;

      const response = await this.geminiService.generateResponse(prompt);
      
      // Split long responses if needed
      if (response.length > 2000) {
        const chunks = this.splitMessage(response, 2000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(response);
      }
    } catch (error) {
      this.logger.error('Error in AI chat:', error);
      await message.reply('Sorry, I had trouble processing your message. Please try again or use specific commands.');
    }
  }

  private async ensureUserExists(discordId: string, username: string): Promise<User> {
    let user = await this.userRepository.findOne({ where: { discordId } });
    
    if (!user) {
      user = this.userRepository.create({
        discordId,
        username,
      });
      await this.userRepository.save(user);
      this.logger.log(`Created new user: ${username} (${discordId})`);
    }
    
    return user;
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks = [];
    let currentChunk = '';

    const sentences = text.split('. ');
    for (const sentence of sentences) {
      if ((currentChunk + sentence + '. ').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      currentChunk += sentence + '. ';
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async handleHealthCommand(message: Message, args: string[], user: User) {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'record':
        await this.recordHealthData(message, args.slice(1), user);
        break;
      case 'history':
        await this.showHealthHistory(message, user);
        break;
      case 'bmi':
        await this.calculateBMI(message, args.slice(1), user);
        break;
      default:
        await message.reply('🏥 **Health Commands**\n`!health record <type> <value> <notes>` - Record health data\n`!health history` - View health history\n`!health bmi <height> <weight>` - Calculate BMI');
    }
  }

  private async recordHealthData(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('📝 **Record Health Data**\nUsage: `!health record <type> <value> [notes]`\nTypes: weight, blood_pressure, heart_rate, glucose, temperature, medication\nExample: `!health record weight 70kg Feeling good today`');
      return;
    }

    const type = args[0].toLowerCase();
    const value = args[1];
    const notes = args.slice(2).join(' ') || '';

    const validTypes = ['weight', 'blood_pressure', 'heart_rate', 'glucose', 'temperature', 'medication', 'exercise', 'sleep'];
    
    if (!validTypes.includes(type)) {
      await message.reply(`❌ Invalid type. Valid types: ${validTypes.join(', ')}`);
      return;
    }

    try {
      const healthRecord = this.healthRecordRepository.create({
        user,
        type: type as any, // Cast to enum if needed
        data:value,
        notes,
        recordedAt: new Date(),
      });

      await this.healthRecordRepository.save(healthRecord);
      
      // Generate AI advice
      const aiAdvice = await this.geminiService.generateHealthAdvice({
        type,
        value,
        notes,
      });

      await message.reply(`✅ **Health Record Saved**\n📊 Type: ${type}\n📈 Value: ${value}\n📝 Notes: ${notes || 'None'}\n🕐 Time: ${new Date().toLocaleString()}\n\n🤖 **AI Advice**: ${aiAdvice}`);
    } catch (error) {
      this.logger.error('Error saving health record:', error);
      await message.reply('❌ Failed to save health record. Please try again.');
    }
  }

  private async showHealthHistory(message: Message, user: User) {
    try {
      const records = await this.healthRecordRepository.find({
        where: { user: { id: user.id } },
        order: { recordedAt: 'DESC' },
        take: 10,
      });

      if (records.length === 0) {
        await message.reply('📊 **Health History**\nNo health records found. Start recording with `!health record`');
        return;
      }

      const historyEmbed = {
        color: 0x00ff00,
        title: '📊 Your Recent Health History',
        fields: records.map((record, index) => ({
          name: `${index + 1}. ${record.type.toUpperCase()}`,
          value: `📈 **Value:** ${record.data}\n📝 **Notes:** ${record.notes || 'None'}\n🕐 **Date:** ${record.recordedAt.toLocaleDateString()}`,
          inline: true,
        })),
        timestamp: new Date().toISOString(),
      };

      await message.reply({ embeds: [historyEmbed] });
    } catch (error) {
      this.logger.error('Error fetching health history:', error);
      await message.reply('❌ Failed to fetch health history. Please try again.');
    }
  }

  private async calculateBMI(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('📏 **BMI Calculator**\nUsage: `!health bmi <height_cm> <weight_kg>`\nExample: `!health bmi 175 70`');
      return;
    }

    const height = parseFloat(args[0]);
    const weight = parseFloat(args[1]);

    if (isNaN(height) || isNaN(weight) || height <= 0 || weight <= 0) {
      await message.reply('❌ Please provide valid height (cm) and weight (kg) values.');
      return;
    }

    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    let category = '';
    let color = 0x00ff00;

    if (bmi < 18.5) {
      category = 'Underweight';
      color = 0xffa500;
    } else if (bmi < 25) {
      category = 'Normal weight';
      color = 0x00ff00;
    } else if (bmi < 30) {
      category = 'Overweight';
      color = 0xffa500;
    } else {
      category = 'Obese';
      color = 0xff0000;
    }

    const bmiEmbed = {
      color,
      title: '📏 BMI Calculation Result',
      fields: [
        { name: '📊 BMI', value: bmi.toFixed(1), inline: true },
        { name: '📋 Category', value: category, inline: true },
        { name: '📏 Height', value: `${height} cm`, inline: true },
        { name: '⚖️ Weight', value: `${weight} kg`, inline: true },
      ],
      footer: {
        text: 'Note: BMI is a general indicator. Consult healthcare professionals for personalized advice.',
      },
    };

    await message.reply({ embeds: [bmiEmbed] });

    // Save BMI as health record
    try {
      const healthRecord = this.healthRecordRepository.create({
        user,
        type: HealthRecordType.BMI,
        data: bmi.toFixed(1) as any,
        notes: `Height: ${height}cm, Weight: ${weight}kg, Category: ${category}`,
        recordedAt: new Date(),
      });
      await this.healthRecordRepository.save(healthRecord);
    } catch (error) {
      this.logger.error('Error saving BMI record:', error);
    }
  }

  private async handleReminderCommand(message: Message, args: string[], user: User) {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'add':
        await this.addReminder(message, args.slice(1), user);
        break;
      case 'list':
        await this.listReminders(message, user);
        break;
      case 'delete':
        await this.deleteReminder(message, args.slice(1), user);
        break;
      default:
        await message.reply('⏰ **Reminder Commands**\n`!reminder add <time> <message>` - Add new reminder\n`!reminder list` - View active reminders\n`!reminder delete <id>` - Delete reminder\n\nTime format: HH:MM (24-hour) or "daily HH:MM"');
    }
  }

  private async addReminder(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('⏰ **Add Reminder**\nUsage: `!reminder add <time> <title> [description]`\nExamples:\n`!reminder add 14:30 "Take medication" Daily blood pressure pills`\n`!reminder add daily 08:00 "Morning vitamins"`');
      return;
    }

    let timeStr = args[0];
    let frequency = 'once';
    let title = '';
    let description = '';
    
    if (args[0].toLowerCase() === 'daily') {
      frequency = 'daily';
      timeStr = args[1];
      title = args.slice(2, 3).join(' ').replace(/"/g, '');
      description = args.slice(3).join(' ').replace(/"/g, '');
    } else {
      title = args.slice(1, 2).join(' ').replace(/"/g, '');
      description = args.slice(2).join(' ').replace(/"/g, '');
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeStr)) {
      await message.reply('❌ Invalid time format. Please use HH:MM (24-hour format).');
      return;
    }

    try {
      const reminder = this.reminderRepository.create({
        user,
        title,
        description,
        type: ReminderType.CUSTOM,
        frequency: frequency as any,
        reminderTime: timeStr,
        isActive: true,
      });

      await this.reminderRepository.save(reminder);
      
      const recurringText = frequency === 'daily' ? 'daily ' : 'one-time ';
      await message.reply(`✅ **Reminder Set**\n⏰ ${recurringText}reminder at ${timeStr}\n📝 Title: "${title}"\n📄 Description: "${description || 'None'}"`);
    } catch (error) {
      this.logger.error('Error saving reminder:', error);
      await message.reply('❌ Failed to save reminder. Please try again.');
    }
  }

  private async listReminders(message: Message, user: User) {
    try {
      const reminders = await this.reminderRepository.find({
        where: { user: { id: user.id }, isActive: true },
        order: { reminderTime: 'ASC' },
      });

      if (reminders.length === 0) {
        await message.reply('⏰ **Your Reminders**\nNo active reminders found. Add one with `!reminder add`');
        return;
      }

      const reminderEmbed = {
        color: 0xffa500,
        title: '⏰ Your Active Reminders',
        fields: reminders.map((reminder) => ({
          name: `${reminder.id}. ${reminder.frequency === 'daily' ? 'Daily' : 'One-time'} - ${reminder.reminderTime}`,
          value: `📝 ${reminder.title}\n📄 ${reminder.description || 'No description'}`,
          inline: false,
        })),
        footer: {
          text: 'Use !reminder delete <id> to remove a reminder',
        },
      };

      await message.reply({ embeds: [reminderEmbed] });
    } catch (error) {
      this.logger.error('Error fetching reminders:', error);
      await message.reply('❌ Failed to fetch reminders. Please try again.');
    }
  }

  private async deleteReminder(message: Message, args: string[], user: User) {
    if (args.length === 0) {
      await message.reply('❌ Please provide reminder ID. Use `!reminder list` to see IDs.');
      return;
    }

    const reminderId = parseInt(args[0]);
    if (isNaN(reminderId)) {
      await message.reply('❌ Please provide a valid reminder ID (number).');
      return;
    }

    try {
      const reminder = await this.reminderRepository.findOne({
        where: { id: reminderId, user: { id: user.id } },
      });

      if (!reminder) {
        await message.reply('❌ Reminder not found or you don\'t have permission to delete it.');
        return;
      }

      await this.reminderRepository.remove(reminder);
      await message.reply(`✅ **Reminder Deleted**\nRemoved reminder: "${reminder.title}" at ${reminder.reminderTime}`);
    } catch (error) {
      this.logger.error('Error deleting reminder:', error);
      await message.reply('❌ Failed to delete reminder. Please try again.');
    }
  }

  private async handleEmergencyCommand(message: Message, args: string[], user: User) {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'add':
        await this.addEmergencyContact(message, args.slice(1), user);
        break;
      case 'list':
        await this.listEmergencyContacts(message, user);
        break;
      case 'call':
        await this.showEmergencyNumbers(message);
        break;
      default:
        await message.reply('🚨 **Emergency Commands**\n`!emergency add <name> <phone> <relation>` - Add emergency contact\n`!emergency list` - View emergency contacts\n`!emergency call` - Show emergency numbers');
    }
  }

  private async addEmergencyContact(message: Message, args: string[], user: User) {
    if (args.length < 3) {
      await message.reply('🚨 **Add Emergency Contact**\nUsage: `!emergency add <name> <phone> <relation>`\nExample: `!emergency add "Dr. Smith" +1234567890 "Family Doctor"`');
      return;
    }

    const name = args[0].replace(/"/g, '');
    const phone = args[1];
    const relation = args.slice(2).join(' ').replace(/"/g, '');

    try {
      const contact = this.emergencyContactRepository.create({
        user: user,
        name,
        phoneNumber: phone,
        relationship: relation,
      });

      await this.emergencyContactRepository.save(contact);
      await message.reply(`✅ **Emergency Contact Added**\n👤 Name: ${name}\n📞 Phone: ${phone}\n🏷️ Relation: ${relation}`);
    } catch (error) {
      this.logger.error('Error saving emergency contact:', error);
      await message.reply('❌ Failed to save emergency contact. Please try again.');
    }
  }

  private async listEmergencyContacts(message: Message, user: User) {
    try {
      const contacts = await this.emergencyContactRepository.find({
        where: { user: { id: user.id } },
        order: { name: 'ASC' },
      });

      if (contacts.length === 0) {
        await message.reply('🚨 **Emergency Contacts**\nNo emergency contacts found. Add one with `!emergency add`');
        return;
      }

      const contactEmbed = {
        color: 0xff0000,
        title: '🚨 Your Emergency Contacts',
        fields: contacts.map((contact) => ({
          name: `👤 ${contact.name}`,
          value: `📞 ${contact.phoneNumber}\n🏷️ ${contact.relationship}`,
          inline: true,
        })),
        footer: {
          text: 'Keep these contacts updated and accessible',
        },
      };

      await message.reply({ embeds: [contactEmbed] });
    } catch (error) {
      this.logger.error('Error fetching emergency contacts:', error);
      await message.reply('❌ Failed to fetch emergency contacts. Please try again.');
    }
  }

  private async showEmergencyNumbers(message: Message) {
    const emergencyEmbed = {
      color: 0xff0000,
      title: '🚨 Emergency Numbers',
      fields: [
        { name: '🚑 Emergency Services (US)', value: '911', inline: true },
        { name: '☎️ Poison Control (US)', value: '1-800-222-1222', inline: true },
        { name: '🧠 Mental Health Crisis', value: '988', inline: true },
        { name: '📞 Crisis Text Line', value: 'Text HOME to 741741', inline: false },
      ],
      footer: {
        text: 'In case of emergency, always call your local emergency number first',
      },
    };

    await message.reply({ embeds: [emergencyEmbed] });
  }

  private async handleStatsCommand(message: Message, user: User) {
    try {
      const userWithRelations = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['healthRecords', 'reminders', 'emergencyContacts'],
      });

      if (!userWithRelations) {
        await message.reply('❌ User not found. Please try again.');
        return;
      }

      const activeReminders = userWithRelations.reminders?.filter(r => r.isActive) || [];

      const statsEmbed = {
        color: 0x0099ff,
        title: '📊 Your Health Bot Statistics',
        fields: [
          { name: '📈 Health Records', value: (userWithRelations.healthRecords?.length || 0).toString(), inline: true },
          { name: '⏰ Active Reminders', value: activeReminders.length.toString(), inline: true },
          { name: '🚨 Emergency Contacts', value: (userWithRelations.emergencyContacts?.length || 0).toString(), inline: true },
          { name: '📅 Member Since', value: userWithRelations.createdAt.toLocaleDateString(), inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      await message.reply({ embeds: [statsEmbed] });
    } catch (error) {
      this.logger.error('Error fetching user stats:', error);
      await message.reply('❌ Failed to fetch statistics. Please try again.');
    }
  }

  private async sendHelpMessage(message: Message) {
    const helpEmbed = {
      color: 0x0099ff,
      title: '🏥 Health Care Bot Commands',
      description: 'Your personal health assistant on Discord!',
      fields: [
        {
          name: '🏓 Basic Commands',
          value: '`!ping` - Check bot status\n`!help` - Show this help message\n`!stats` - View your statistics',
          inline: false,
        },
        {
          name: '🏥 Health Commands',
          value: '`!health record <type> <value> [notes]` - Record health data\n`!health history` - View health history\n`!health bmi <height> <weight>` - Calculate BMI',
          inline: false,
        },
        {
          name: '⏰ Reminder Commands',
          value: '`!reminder add <time> <message>` - Add reminder\n`!reminder list` - View active reminders\n`!reminder delete <id>` - Delete reminder',
          inline: false,
        },
        {
          name: '🚨 Emergency Commands',
          value: '`!emergency add <name> <phone> <relation>` - Add contact\n`!emergency list` - View contacts\n`!emergency call` - Show emergency numbers',
          inline: false,
        },
        {
          name: '🤖 AI Chat',
          value: 'Mention me (@HealthBot) or DM me for natural conversation about health topics!',
          inline: false,
        },
      ],
      footer: {
        text: 'Always consult healthcare professionals for serious medical concerns',
      },
      timestamp: new Date().toISOString(),
    };

    await message.reply({ embeds: [helpEmbed] });
  }
}
