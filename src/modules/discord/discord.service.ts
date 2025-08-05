import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { CommandHandler } from './command.handler';

@Injectable()
export class DiscordService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client;

  constructor(
    private configService: ConfigService,
    private commandHandler: CommandHandler,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
  }

  async onApplicationBootstrap() {
    await this.initializeBot();
  }

  private async initializeBot() {
    const token = this.configService.get('DISCORD_TOKEN');
    
    if (!token) {
      this.logger.error('Discord token not found in environment variables');
      return;
    }

    this.client.on('ready', () => {
      this.logger.log(`🤖 Bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;

      const prefix = this.configService.get('BOT_PREFIX', '!');
      
      if (message.content.startsWith(prefix)) {
        await this.commandHandler.handleCommand(message);
      } else if (message.mentions.has(this.client.user!) || message.channel.type === 1) {
        // Handle direct mentions or DMs
        await this.commandHandler.handleMention(message);
      }
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error:', error);
    });

    try {
      await this.client.login(token);
    } catch (error) {
      this.logger.error('Failed to login to Discord:', error);
    }
  }

  getClient(): Client {
    return this.client;
  }

  async sendMessage(channelId: string, content: string) {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (channel) {
        await channel.send(content);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channelId}:`, error);
    }
  }

  async sendDirectMessage(userId: string, content: string) {
    try {
      const user = await this.client.users.fetch(userId);
      if (user) {
        await user.send(content);
      }
    } catch (error) {
      this.logger.error(`Failed to send DM to user ${userId}:`, error);
    }
  }
}
