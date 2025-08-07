# PostgreSQL to SQLite Migration Guide

This document outlines the changes made to migrate the Discord Health Bot from PostgreSQL to SQLite.

## Changes Made

### 1. Database Configuration
- Updated `src/config/database.config.ts` to use SQLite instead of PostgreSQL
- Changed connection type from `postgres` to `sqlite`
- Simplified configuration to only require a database file path

### 2. Dependencies
- Removed: `pg` (PostgreSQL driver)
- Added: `sqlite3` (SQLite driver)

### 3. Environment Variables
Updated `.env.example` to replace PostgreSQL connection variables with:
```bash
# Database Configuration
DATABASE_PATH=data/discord-health-bot.db
```

### 4. Entity Changes
Made the following changes to ensure SQLite compatibility:

#### User Entity (`src/modules/health/entities/user.entity.ts`)
- Changed `preferences` column from `json` type to `text` type
- JSON data will be stored as stringified JSON

#### Health Record Entity (`src/modules/health/entities/health-record.entity.ts`)
- Changed `type` column from enum to string
- Changed `data` column from `json` type to `text` type
- Enum values are still available as constants for validation

#### Reminder Entity (`src/modules/health/entities/reminder.entity.ts`)
- Changed `type` column from enum to string
- Changed `frequency` column from enum to string
- Changed `customSchedule` column from `json` type to `text` type

### 5. File Structure
- Created `data/` directory for SQLite database file
- Updated `.gitignore` to exclude `data/*.db` files

## Important Notes

### JSON Handling
Since SQLite doesn't have native JSON support, JSON data is now stored as text. You'll need to:
- Parse JSON strings when reading: `JSON.parse(jsonString)`
- Stringify objects when saving: `JSON.stringify(object)`

### Enum Values
Enum types are now stored as strings. The enum constants are still available for validation:
```typescript
// You can still use enum values for validation
if (record.type === HealthRecordType.BLOOD_PRESSURE) {
  // Handle blood pressure record
}
```

### Migration Steps
1. Install dependencies: `pnpm install`
2. Update your `.env` file with the new database configuration
3. Run the application - TypeORM will automatically create the SQLite database and tables

## Benefits of SQLite
- No separate database server required
- File-based storage
- Perfect for development and small to medium applications
- Cross-platform compatibility
- Zero configuration setup
