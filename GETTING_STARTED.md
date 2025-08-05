# Discord Health Bot Server

## 🚀 Quick Start

Your Discord Health Bot with real-time monitoring is now set up! Here's how to get started:

### 1. 📋 Configure Environment Variables

Copy the `.env.example` file to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required Configuration:**
- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID  
- `GEMINI_API_KEY` - Your Google Gemini AI API key
- Database settings (MySQL)

### 2. 🗄️ Set Up Database

Create a MySQL database:
```sql
CREATE DATABASE discord_health_bot;
```

### 3. 🏃‍♂️ Start the Server

```bash
# Development mode with auto-reload
pnpm run dev

# Production mode
pnpm run build
pnpm run start:prod
```

## 🌟 Features Available

### Discord Bot Commands
- `!help` - View all available commands
- `!health record weight 70kg` - Record health data
- `!reminder add 08:00 "Take vitamins"` - Set reminders
- `!emergency add "Dr. Smith" +1234567890 "Doctor"` - Add emergency contacts

### Real-time Monitoring Dashboard
Visit: `http://localhost:3000`
- Live health events stream
- WebSocket real-time communication
- System statistics
- AI chat interface

### API Documentation
Visit: `http://localhost:3000/api/docs`
- Interactive API explorer
- Server-sent events endpoints
- WebSocket event documentation

### Real-time Endpoints
- **SSE Stream**: `http://localhost:3000/health-monitor/events`
- **WebSocket**: `ws://localhost:3000/health`
- **User Events**: `http://localhost:3000/health-monitor/user/{discordId}/events`

## 🎯 Next Steps

1. **Invite your bot to Discord**:
   - Go to Discord Developer Portal
   - Generate invite link with proper permissions
   - Add bot to your server

2. **Test the features**:
   - Use `!ping` to test bot connectivity
   - Record some health data with `!health record`
   - Set up reminders with `!reminder add`

3. **Monitor in real-time**:
   - Open the dashboard at `http://localhost:3000`
   - Watch live events as users interact with the bot
   - Use the AI chat feature

4. **Explore the API**:
   - Check out `/api/docs` for full API documentation
   - Test Server-Sent Events streams
   - Connect to WebSocket endpoints

## 🔧 Available Scripts

- `pnpm run dev` - Development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start:prod` - Start production server
- `pnpm run test` - Run tests
- `pnpm run lint` - Lint code

## 📚 Documentation

For detailed documentation, check:
- `README.md` - Full project documentation
- `/api/docs` - API documentation (when server is running)
- `.env.example` - Configuration reference

## 🐛 Troubleshooting

**Bot not responding?**
- Check your Discord token is correct
- Ensure bot has proper permissions in Discord server
- Verify database connection

**Real-time features not working?**
- Check if port 3000 is available
- Verify WebSocket connections aren't blocked by firewall
- Check browser console for errors

**Database errors?**
- Ensure MySQL is running
- Check database credentials in `.env`
- Verify database exists

Enjoy your Discord Health Bot with real-time monitoring! 🏥🤖
