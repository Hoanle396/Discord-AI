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
      const healthContext = `You are a helpful health care assistant bot. Your role is to:
1. Provide general health and wellness information
2. Help users track their health data
3. Offer encouragement for healthy habits
4. Remind users to consult healthcare professionals for serious concerns
5. Be empathetic and supportive

Important: Always remind users that this is general information and they should consult healthcare professionals for personalized medical advice.

User Query: ${prompt}`;

      const result = await model.generateContent(healthContext);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini AI');
      }

      return text.trim();
    } catch (error) {
      this.logger.error('Error generating response from Gemini AI:', error);
      return 'I apologize, but I\'m having trouble processing your request right now. Please try again later or use specific bot commands like `!help` to see what I can do.';
    }
  }

  async generateHealthAdvice(healthData: {
    type: string;
    value: string;
    notes?: string;
  }): Promise<string> {
    try {
      const prompt = `Based on the following health data, provide a brief, encouraging response with general wellness tips:
      
Type: ${healthData.type}
Value: ${healthData.value}
Notes: ${healthData.notes || 'None'}

Please provide a supportive response that acknowledges their health tracking effort and offers general wellness advice. Keep it under 200 words.`;

      return await this.generateResponse(prompt);
    } catch (error) {
      this.logger.error('Error generating health advice:', error);
      return 'Great job tracking your health! Keep up the good work and remember to consult with healthcare professionals for personalized advice.';
    }
  }

  async generateReminderMessage(reminderType: string): Promise<string> {
    try {
      const prompt = `Generate a friendly and motivating reminder message for: ${reminderType}. 
      Make it encouraging and brief (under 100 words). Focus on the positive aspects of maintaining health.`;

      return await this.generateResponse(prompt);
    } catch (error) {
      this.logger.error('Error generating reminder message:', error);
      return `⏰ Friendly reminder: ${reminderType}. Take care of yourself! 💚`;
    }
  }
}
