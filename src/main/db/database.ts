// ABOUTME: SQLite database initialization and migration
// ABOUTME: Handles queue and generation history persistence

import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

let db: Database.Database | null = null;

const getDataPath = (): string => {
	const dataPath = join(app.getPath("home"), ".forgecraft");
	if (!existsSync(dataPath)) {
		mkdirSync(dataPath, { recursive: true });
	}
	return dataPath;
};

const getDbPath = (): string => {
	return join(getDataPath(), "forgecraft.db");
};

// Migration definitions
const migrations: { version: number; up: string }[] = [
	{
		version: 1,
		up: `
			-- Schema version tracking
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY,
				applied_at INTEGER NOT NULL
			);

			-- Generation queue
			CREATE TABLE IF NOT EXISTS generation_queue (
				id TEXT PRIMARY KEY,
				status TEXT NOT NULL DEFAULT 'pending',
				request TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				started_at INTEGER,
				completed_at INTEGER,
				error TEXT,
				result_seed INTEGER
			);

			CREATE INDEX IF NOT EXISTS idx_queue_status ON generation_queue(status);

			-- Generation history
			CREATE TABLE IF NOT EXISTS generations (
				id TEXT PRIMARY KEY,
				theme_id TEXT,
				template_id TEXT,
				template_values TEXT,
				prompt TEXT NOT NULL,
				negative_prompt TEXT,
				seed INTEGER NOT NULL,
				output_path TEXT NOT NULL,
				model TEXT NOT NULL,
				width INTEGER NOT NULL,
				height INTEGER NOT NULL,
				steps INTEGER NOT NULL,
				cfg_scale REAL NOT NULL,
				generation_time_ms INTEGER,
				created_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_generations_theme ON generations(theme_id);
			CREATE INDEX IF NOT EXISTS idx_generations_template ON generations(template_id);
		`,
	},
];

const getCurrentVersion = (database: Database.Database): number => {
	try {
		const result = database
			.prepare("SELECT MAX(version) as version FROM schema_version")
			.get() as { version: number | null } | undefined;
		return result?.version ?? 0;
	} catch {
		// Table doesn't exist yet
		return 0;
	}
};

const runMigrations = (database: Database.Database): void => {
	const currentVersion = getCurrentVersion(database);

	for (const migration of migrations) {
		if (migration.version > currentVersion) {
			database.exec(migration.up);
			database
				.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)")
				.run(migration.version, Date.now());
			console.log(`[DB] Applied migration v${migration.version}`);
		}
	}
};

export const initDatabase = (): Database.Database => {
	if (db) return db;

	const dbPath = getDbPath();
	console.log(`[DB] Initializing database at ${dbPath}`);

	db = new Database(dbPath);

	// Enable WAL mode for better concurrent performance
	db.pragma("journal_mode = WAL");

	// Run migrations
	runMigrations(db);

	// Recovery: reset any interrupted generations to pending
	const resetCount = db
		.prepare(
			"UPDATE generation_queue SET status = 'pending', started_at = NULL WHERE status = 'generating'",
		)
		.run();
	if (resetCount.changes > 0) {
		console.log(`[DB] Reset ${resetCount.changes} interrupted generations to pending`);
	}

	return db;
};

export const getDatabase = (): Database.Database => {
	if (!db) {
		throw new Error("Database not initialized. Call initDatabase() first.");
	}
	return db;
};

export const closeDatabase = (): void => {
	if (db) {
		db.close();
		db = null;
		console.log("[DB] Database closed");
	}
};

// Export data path helper for other modules
export { getDataPath };
