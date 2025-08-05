# Discord Health Bot

A comprehensive Discord bot built with NestJS featuring:
- 🤖 Gemini AI integration for intelligent conversations
- 🏥 Health care reminders and tracking
- ⏰ Scheduled tasks for medication reminders
- 📊 Health metrics tracking
- 💬 Interactive chat commands

## Features

### Health Care Commands
- `/health-reminder` - Set medication or appointment reminders
- `/track-vitals` - Track blood pressure, heart rate, weight, etc.
- `/health-tips` - Get daily health tips powered by Gemini AI
- `/symptoms-check` - Basic symptom checker with AI assistance
- `/emergency-contacts` - Manage emergency contact information

### AI-Powered Chat
- Natural language processing with Google Gemini AI
- Health-related question answering
- Personalized health advice (for informational purposes only)

### Scheduled Tasks
- Daily medication reminders
- Weekly health check-ins
- Monthly health metric summaries

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Add your tokens to `.env`:
- Discord Bot Token
- Google Gemini API Key
- Database credentials

4. Run the bot:
```bash
npm run start:dev
```

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token
- `GEMINI_API_KEY` - Google Gemini AI API key
- `DATABASE_HOST` - Database host
- `DATABASE_PORT` - Database port
- `DATABASE_USERNAME` - Database username
- `DATABASE_PASSWORD` - Database password
- `DATABASE_NAME` - Database name

## Commands

### General Commands
- `!help` - Show all available commands
- `!ping` - Check bot responsiveness
- `!ai <message>` - Chat with Gemini AI

### Health Commands
- `!remind <medication> <time>` - Set medication reminder
- `!vitals <type> <value>` - Record vital signs
- `!tips` - Get health tips
- `!emergency add <name> <contact>` - Add emergency contact

## Disclaimer

This bot is for informational purposes only and should not replace professional medical advice. Always consult with healthcare professionals for medical decisions.
