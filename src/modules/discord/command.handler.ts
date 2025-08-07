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
          await message.reply('Pong! 🏓 Bot đang hoạt động tốt!');
          break;
        case 'health':
        case 'suckhoe':
          await this.handleHealthCommand(message, args, user);
          break;
        case 'reminder':
        case 'nhacnho':
          await this.handleReminderCommand(message, args, user);
          break;
        case 'emergency':
        case 'khancap':
          await this.handleEmergencyCommand(message, args, user);
          break;
        case 'stats':
        case 'thongke':
          await this.handleStatsCommand(message, user);
          break;
        case 'help':
        case 'trogiup':
          await this.sendHelpMessage(message);
          break;
        default:
          await message.reply('Lệnh không hợp lệ. Gõ `!help` hoặc `!trogiup` để xem các lệnh có sẵn.');
      }
    } catch (error) {
      this.logger.error('Error handling command:', error);
      await message.reply('Xin lỗi, đã xảy ra lỗi khi xử lý lệnh của bạn. Vui lòng thử lại.');
    }
  }

  async handleMention(message: Message) {
    try {
      // Show typing indicator

      const user = await this.ensureUserExists(message.author.id, message.author.username);
      
      // Add health context for AI
      const healthContext = `Người dùng: ${user.username}\n`;
      const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
      const prompt = `${healthContext}Ngữ cảnh Bot Sức khỏe: Bạn là một trợ lý chăm sóc sức khỏe hữu ích. Trả lời các câu hỏi liên quan đến sức khỏe, đưa ra lời khuyên về chăm sóc sức khỏe tổng quát, và giúp theo dõi sức khỏe. Luôn nhắc nhở người dùng tham khảo ý kiến của các chuyên gia y tế cho những vấn đề nghiêm trọng. Trả lời bằng tiếng Việt.\n\nTin nhắn của người dùng: ${cleanMessage}`;

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
      await message.reply('Xin lỗi, tôi gặp khó khăn khi xử lý tin nhắn của bạn. Vui lòng thử lại hoặc sử dụng các lệnh cụ thể.');
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
      case 'ghi':
        await this.recordHealthData(message, args.slice(1), user);
        break;
      case 'history':
      case 'lichsu':
        await this.showHealthHistory(message, user);
        break;
      case 'bmi':
        await this.calculateBMI(message, args.slice(1), user);
        break;
      default:
        await message.reply('🏥 **Lệnh Sức khỏe**\n`!health ghi <loại> <giá trị> <ghi chú>` - Ghi lại dữ liệu sức khỏe\n`!health lichsu` - Xem lịch sử sức khỏe\n`!health bmi <chiều cao> <cân nặng>` - Tính chỉ số BMI');
    }
  }

  private async recordHealthData(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('📝 **Ghi lại Dữ liệu Sức khỏe**\nCách dùng: `!health ghi <loại> <giá trị> [ghi chú]`\nCác loại: cannang, huyetap, nhiptim, duonghuyet, nhietdo, thuoc\nVí dụ: `!health ghi cannang 70kg Cảm thấy khỏe mạnh hôm nay`');
      return;
    }

    const type = args[0].toLowerCase();
    const value = args[1];
    const notes = args.slice(2).join(' ') || '';

    const validTypes = ['cannang', 'huyetap', 'nhiptim', 'duonghuyet', 'nhietdo', 'thuoc', 'tapthe', 'ngu'];
    const typeMap = {
      'cannang': 'weight',
      'huyetap': 'blood_pressure', 
      'nhiptim': 'heart_rate',
      'duonghuyet': 'glucose',
      'nhietdo': 'temperature',
      'thuoc': 'medication',
      'tapthe': 'exercise',
      'ngu': 'sleep'
    };
    
    if (!validTypes.includes(type)) {
      await message.reply(`❌ Loại không hợp lệ. Các loại hợp lệ: ${validTypes.join(', ')}`);
      return;
    }

    try {
      const healthRecord = this.healthRecordRepository.create({
        user,
        type: typeMap[type] as any,
        data: value,
        notes,
        recordedAt: new Date(),
      });

      await this.healthRecordRepository.save(healthRecord);
      
      // Generate AI advice
      const aiAdvice = await this.geminiService.generateHealthAdvice({
        type: typeMap[type],
        value,
        notes,
      });

      await message.reply(`✅ **Đã Lưu Dữ liệu Sức khỏe**\n📊 Loại: ${type}\n📈 Giá trị: ${value}\n📝 Ghi chú: ${notes || 'Không có'}\n🕐 Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n🤖 **Lời khuyên AI**: ${aiAdvice}`);
    } catch (error) {
      this.logger.error('Error saving health record:', error);
      await message.reply('❌ Không thể lưu dữ liệu sức khỏe. Vui lòng thử lại.');
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
        await message.reply('📊 **Lịch sử Sức khỏe**\nKhông tìm thấy dữ liệu sức khỏe nào. Bắt đầu ghi lại với `!health ghi`');
        return;
      }

      const historyEmbed = {
        color: 0x00ff00,
        title: '📊 Lịch sử Sức khỏe Gần đây của Bạn',
        fields: records.map((record, index) => ({
          name: `${index + 1}. ${record.type.toUpperCase()}`,
          value: `📈 **Giá trị:** ${record.data}\n📝 **Ghi chú:** ${record.notes || 'Không có'}\n🕐 **Ngày:** ${new Date(record.recordedAt).toLocaleDateString('vi-VN')}`,
          inline: true,
        })),
        timestamp: new Date().toISOString(),
      };

      await message.reply({ embeds: [historyEmbed] });
    } catch (error) {
      this.logger.error('Error fetching health history:', error);
      await message.reply('❌ Không thể lấy lịch sử sức khỏe. Vui lòng thử lại.');
    }
  }

  private async calculateBMI(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('📏 **Máy tính BMI**\nCách dùng: `!health bmi <chiều_cao_cm> <cân_nặng_kg>`\nVí dụ: `!health bmi 175 70`');
      return;
    }

    const height = parseFloat(args[0]);
    const weight = parseFloat(args[1]);

    if (isNaN(height) || isNaN(weight) || height <= 0 || weight <= 0) {
      await message.reply('❌ Vui lòng cung cấp chiều cao (cm) và cân nặng (kg) hợp lệ.');
      return;
    }

    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    let category = '';
    let color = 0x00ff00;

    if (bmi < 18.5) {
      category = 'Thiếu cân';
      color = 0xffa500;
    } else if (bmi < 25) {
      category = 'Cân nặng bình thường';
      color = 0x00ff00;
    } else if (bmi < 30) {
      category = 'Thừa cân';
      color = 0xffa500;
    } else {
      category = 'Béo phì';
      color = 0xff0000;
    }

    const bmiEmbed = {
      color,
      title: '📏 Kết quả Tính BMI',
      fields: [
        { name: '📊 BMI', value: bmi.toFixed(1), inline: true },
        { name: '📋 Phân loại', value: category, inline: true },
        { name: '📏 Chiều cao', value: `${height} cm`, inline: true },
        { name: '⚖️ Cân nặng', value: `${weight} kg`, inline: true },
      ],
      footer: {
        text: 'Lưu ý: BMI chỉ là chỉ số tham khảo. Hãy tham khảo ý kiến chuyên gia y tế để có lời khuyên cá nhân hóa.',
      },
    };

    await message.reply({ embeds: [bmiEmbed] });

    // Save BMI as health record
    try {
      const healthRecord = this.healthRecordRepository.create({
        user,
        type: HealthRecordType.BMI,
        data: bmi.toFixed(1) as any,
        notes: `Chiều cao: ${height}cm, Cân nặng: ${weight}kg, Phân loại: ${category}`,
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
      case 'them':
        await this.addReminder(message, args.slice(1), user);
        break;
      case 'list':
      case 'danhsach':
        await this.listReminders(message, user);
        break;
      case 'delete':
      case 'xoa':
        await this.deleteReminder(message, args.slice(1), user);
        break;
      default:
        await message.reply('⏰ **Lệnh Nhắc nhở**\n`!reminder them <thời gian> <tin nhắn>` - Thêm nhắc nhở mới\n`!reminder danhsach` - Xem các nhắc nhở đang hoạt động\n`!reminder xoa <id>` - Xóa nhắc nhở\n\nĐịnh dạng thời gian: HH:MM (24 giờ) hoặc "hangngay HH:MM"');
    }
  }

  private async addReminder(message: Message, args: string[], user: User) {
    if (args.length < 2) {
      await message.reply('⏰ **Thêm Nhắc nhở**\nCách dùng: `!reminder them <thời gian> <tiêu đề> [mô tả]`\nVí dụ:\n`!reminder them 14:30 "Uống thuốc" Thuốc huyết áp hàng ngày`\n`!reminder them hangngay 08:00 "Vitamin buổi sáng"`');
      return;
    }

    let timeStr = args[0];
    let frequency = 'once';
    let title = '';
    let description = '';
    
    if (args[0].toLowerCase() === 'hangngay' || args[0].toLowerCase() === 'daily') {
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
      await message.reply('❌ Định dạng thời gian không hợp lệ. Vui lòng sử dụng HH:MM (định dạng 24 giờ).');
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
      
      const recurringText = frequency === 'daily' ? 'hàng ngày ' : 'một lần ';
      await message.reply(`✅ **Đã Đặt Nhắc nhở**\n⏰ Nhắc nhở ${recurringText}lúc ${timeStr}\n📝 Tiêu đề: "${title}"\n📄 Mô tả: "${description || 'Không có'}"`);
    } catch (error) {
      this.logger.error('Error saving reminder:', error);
      await message.reply('❌ Không thể lưu nhắc nhở. Vui lòng thử lại.');
    }
  }

  private async listReminders(message: Message, user: User) {
    try {
      const reminders = await this.reminderRepository.find({
        where: { user: { id: user.id }, isActive: true },
        order: { reminderTime: 'ASC' },
      });

      if (reminders.length === 0) {
        await message.reply('⏰ **Nhắc nhở của Bạn**\nKhông tìm thấy nhắc nhở nào đang hoạt động. Thêm một cái với `!reminder them`');
        return;
      }

      const reminderEmbed = {
        color: 0xffa500,
        title: '⏰ Nhắc nhở Đang hoạt động của Bạn',
        fields: reminders.map((reminder) => ({
          name: `${reminder.id}. ${reminder.frequency === 'daily' ? 'Hàng ngày' : 'Một lần'} - ${reminder.reminderTime}`,
          value: `📝 ${reminder.title}\n📄 ${reminder.description || 'Không có mô tả'}`,
          inline: false,
        })),
        footer: {
          text: 'Sử dụng !reminder xoa <id> để xóa nhắc nhở',
        },
      };

      await message.reply({ embeds: [reminderEmbed] });
    } catch (error) {
      this.logger.error('Error fetching reminders:', error);
      await message.reply('❌ Không thể lấy danh sách nhắc nhở. Vui lòng thử lại.');
    }
  }

  private async deleteReminder(message: Message, args: string[], user: User) {
    if (args.length === 0) {
      await message.reply('❌ Vui lòng cung cấp ID nhắc nhở. Sử dụng `!reminder danhsach` để xem các ID.');
      return;
    }

    const reminderId = parseInt(args[0]);
    if (isNaN(reminderId)) {
      await message.reply('❌ Vui lòng cung cấp ID nhắc nhở hợp lệ (số).');
      return;
    }

    try {
      const reminder = await this.reminderRepository.findOne({
        where: { id: reminderId, user: { id: user.id } },
      });

      if (!reminder) {
        await message.reply('❌ Không tìm thấy nhắc nhở hoặc bạn không có quyền xóa nó.');
        return;
      }

      await this.reminderRepository.remove(reminder);
      await message.reply(`✅ **Đã Xóa Nhắc nhở**\nĐã xóa nhắc nhở: "${reminder.title}" lúc ${reminder.reminderTime}`);
    } catch (error) {
      this.logger.error('Error deleting reminder:', error);
      await message.reply('❌ Không thể xóa nhắc nhở. Vui lòng thử lại.');
    }
  }

  private async handleEmergencyCommand(message: Message, args: string[], user: User) {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'add':
      case 'them':
        await this.addEmergencyContact(message, args.slice(1), user);
        break;
      case 'list':
      case 'danhsach':
        await this.listEmergencyContacts(message, user);
        break;
      case 'call':
      case 'goi':
        await this.showEmergencyNumbers(message);
        break;
      default:
        await message.reply('🚨 **Lệnh Khẩn cấp**\n`!emergency them <tên> <sđt> <mối quan hệ>` - Thêm liên hệ khẩn cấp\n`!emergency danhsach` - Xem liên hệ khẩn cấp\n`!emergency goi` - Hiển thị số điện thoại khẩn cấp');
    }
  }

  private async addEmergencyContact(message: Message, args: string[], user: User) {
    if (args.length < 3) {
      await message.reply('🚨 **Thêm Liên hệ Khẩn cấp**\nCách dùng: `!emergency them <tên> <sđt> <mối quan hệ>`\nVí dụ: `!emergency them "Bác sĩ Nguyễn" +84123456789 "Bác sĩ gia đình"`');
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
      await message.reply(`✅ **Đã Thêm Liên hệ Khẩn cấp**\n👤 Tên: ${name}\n📞 Số điện thoại: ${phone}\n🏷️ Mối quan hệ: ${relation}`);
    } catch (error) {
      this.logger.error('Error saving emergency contact:', error);
      await message.reply('❌ Không thể lưu liên hệ khẩn cấp. Vui lòng thử lại.');
    }
  }

  private async listEmergencyContacts(message: Message, user: User) {
    try {
      const contacts = await this.emergencyContactRepository.find({
        where: { user: { id: user.id } },
        order: { name: 'ASC' },
      });

      if (contacts.length === 0) {
        await message.reply('🚨 **Liên hệ Khẩn cấp**\nKhông tìm thấy liên hệ khẩn cấp nào. Thêm một cái với `!emergency them`');
        return;
      }

      const contactEmbed = {
        color: 0xff0000,
        title: '🚨 Liên hệ Khẩn cấp của Bạn',
        fields: contacts.map((contact) => ({
          name: `👤 ${contact.name}`,
          value: `📞 ${contact.phoneNumber}\n🏷️ ${contact.relationship}`,
          inline: true,
        })),
        footer: {
          text: 'Hãy giữ những liên hệ này luôn được cập nhật và dễ tiếp cận',
        },
      };

      await message.reply({ embeds: [contactEmbed] });
    } catch (error) {
      this.logger.error('Error fetching emergency contacts:', error);
      await message.reply('❌ Không thể lấy danh sách liên hệ khẩn cấp. Vui lòng thử lại.');
    }
  }

  private async showEmergencyNumbers(message: Message) {
    const emergencyEmbed = {
      color: 0xff0000,
      title: '🚨 Số điện thoại Khẩn cấp',
      fields: [
        { name: '🚑 Cấp cứu (Việt Nam)', value: '115', inline: true },
        { name: '🚓 Công an (Việt Nam)', value: '113', inline: true },
        { name: '🚒 Cứu hỏa (Việt Nam)', value: '114', inline: true },
        { name: '☎️ Tổng đài cấp cứu 24/7', value: '19009095', inline: true },
        { name: '🧠 Đường dây nóng tâm lý', value: '18001567', inline: true },
        { name: '📞 Tư vấn sức khỏe', value: '19003888', inline: true },
      ],
      footer: {
        text: 'Trong trường hợp khẩn cấp, hãy luôn gọi số cấp cứu địa phương trước',
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
        await message.reply('❌ Không tìm thấy người dùng. Vui lòng thử lại.');
        return;
      }

      const activeReminders = userWithRelations.reminders?.filter(r => r.isActive) || [];

      const statsEmbed = {
        color: 0x0099ff,
        title: '📊 Thống kê Bot Sức khỏe của Bạn',
        fields: [
          { name: '📈 Dữ liệu Sức khỏe', value: (userWithRelations.healthRecords?.length || 0).toString(), inline: true },
          { name: '⏰ Nhắc nhở Đang hoạt động', value: activeReminders.length.toString(), inline: true },
          { name: '🚨 Liên hệ Khẩn cấp', value: (userWithRelations.emergencyContacts?.length || 0).toString(), inline: true },
          { name: '📅 Thành viên từ', value: new Date(userWithRelations.createdAt).toLocaleDateString('vi-VN'), inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      await message.reply({ embeds: [statsEmbed] });
    } catch (error) {
      this.logger.error('Error fetching user stats:', error);
      await message.reply('❌ Không thể lấy thống kê. Vui lòng thử lại.');
    }
  }

  private async sendHelpMessage(message: Message) {
    const helpEmbed = {
      color: 0x0099ff,
      title: '🏥 Lệnh Bot Chăm sóc Sức khỏe',
      description: 'Trợ lý sức khỏe cá nhân của bạn trên Discord!',
      fields: [
        {
          name: '🏓 Lệnh Cơ bản',
          value: '`!ping` - Kiểm tra trạng thái bot\n`!help` hoặc `!trogiup` - Hiển thị tin nhắn trợ giúp này\n`!stats` hoặc `!thongke` - Xem thống kê của bạn',
          inline: false,
        },
        {
          name: '🏥 Lệnh Sức khỏe',
          value: '`!health ghi <loại> <giá trị> [ghi chú]` - Ghi dữ liệu sức khỏe\n`!health lichsu` - Xem lịch sử sức khỏe\n`!health bmi <chiều cao> <cân nặng>` - Tính BMI',
          inline: false,
        },
        {
          name: '⏰ Lệnh Nhắc nhở',
          value: '`!reminder them <thời gian> <tin nhắn>` - Thêm nhắc nhở\n`!reminder danhsach` - Xem nhắc nhở đang hoạt động\n`!reminder xoa <id>` - Xóa nhắc nhở',
          inline: false,
        },
        {
          name: '🚨 Lệnh Khẩn cấp',
          value: '`!emergency them <tên> <sđt> <mối quan hệ>` - Thêm liên hệ\n`!emergency danhsach` - Xem liên hệ\n`!emergency goi` - Hiển thị số khẩn cấp',
          inline: false,
        },
        {
          name: '🤖 Trò chuyện AI',
          value: 'Mention tôi (@HealthBot) hoặc nhắn tin riêng để trò chuyện tự nhiên về các chủ đề sức khỏe!',
          inline: false,
        },
      ],
      footer: {
        text: 'Luôn tham khảo ý kiến chuyên gia y tế cho những vấn đề sức khỏe nghiêm trọng',
      },
      timestamp: new Date().toISOString(),
    };

    await message.reply({ embeds: [helpEmbed] });
  }
}
