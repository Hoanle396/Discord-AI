import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error('Gemini API key not found in environment variables');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      if (!this.genAI) {
        throw new Error('Gemini AI not initialized');
      }

      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Health care context for better responses
      const healthContext = `Bạn là một trợ lý chăm sóc sức khỏe hữu ích. Vai trò của bạn là:
1. Cung cấp thông tin sức khỏe và chăm sóc sức khỏe tổng quát
2. Giúp người dùng theo dõi dữ liệu sức khỏe của họ
3. Khuyến khích các thói quen lành mạnh
4. Nhắc nhở người dùng tham khảo ý kiến chuyên gia y tế cho những vấn đề nghiêm trọng
5. Thể hiện sự đồng cảm và hỗ trợ
6. Trả lời bằng tiếng Việt một cách tự nhiên và thân thiện

Quan trọng: Luôn nhắc nhở người dùng rằng đây chỉ là thông tin tổng quát và họ nên tham khảo ý kiến chuyên gia y tế để có lời khuyên cá nhân hóa.

Câu hỏi của người dùng: ${prompt}`;

      const result = await model.generateContent(healthContext);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini AI');
      }

      return text.trim();
    } catch (error) {
      this.logger.error('Error generating response from Gemini AI:', error);
      return 'Tôi xin lỗi, nhưng hiện tại tôi gặp khó khăn trong việc xử lý yêu cầu của bạn. Vui lòng thử lại sau hoặc sử dụng các lệnh cụ thể của bot như `!help` để xem những gì tôi có thể làm.';
    }
  }

  async generateHealthAdvice(healthData: {
    type: string;
    value: string;
    notes?: string;
  }): Promise<string> {
    try {
      const prompt = `Dựa trên dữ liệu sức khỏe sau, hãy đưa ra phản hồi ngắn gọn, khuyến khích với những lời khuyên chăm sóc sức khỏe tổng quát:
      
Loại: ${healthData.type}
Giá trị: ${healthData.value}
Ghi chú: ${healthData.notes || 'Không có'}

Vui lòng đưa ra phản hồi hỗ trợ, ghi nhận nỗ lực theo dõi sức khỏe của họ và đưa ra lời khuyên chăm sóc sức khỏe tổng quát. Giữ dưới 200 từ và trả lời bằng tiếng Việt.`;

      return await this.generateResponse(prompt);
    } catch (error) {
      this.logger.error('Error generating health advice:', error);
      return 'Tuyệt vời khi bạn theo dõi sức khỏe của mình! Hãy tiếp tục duy trì và nhớ tham khảo ý kiến chuyên gia y tế để có lời khuyên cá nhân hóa.';
    }
  }

  async generateReminderMessage(reminderType: string): Promise<string> {
    try {
      const prompt = `Tạo tin nhắn nhắc nhở thân thiện và động viên cho: ${reminderType}. 
      Làm cho nó khuyến khích và ngắn gọn (dưới 100 từ). Tập trung vào các khía cạnh tích cực của việc duy trì sức khỏe. Trả lời bằng tiếng Việt.`;

      return await this.generateResponse(prompt);
    } catch (error) {
      this.logger.error('Error generating reminder message:', error);
      return `⏰ Nhắc nhở thân thiện: ${reminderType}. Hãy chăm sóc bản thân! 💚`;
    }
  }
}
