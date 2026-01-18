// ABOUTME: Tests for database initialization and migrations
// ABOUTME: Verifies SQLite setup, WAL mode, and schema creation

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import { initDatabase, getDatabase, closeDatabase } from "../database";

describe("Database", () => {
	beforeEach(() => {
		resetTempDir();
	});

	afterEach(() => {
		closeDatabase();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("initDatabase", () => {
		it("should create database and return connection", () => {
			const db = initDatabase();
			expect(db).toBeDefined();
			expect(db.open).toBe(true);
		});

		it("should enable WAL mode", () => {
			const db = initDatabase();
			const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
			expect(result[0].journal_mode).toBe("wal");
		});

		it("should create schema_version table", () => {
			const db = initDatabase();
			const tables = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
				)
				.all();
			expect(tables).toHaveLength(1);
		});

		it("should create generation_queue table", () => {
			const db = initDatabase();
			const tables = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='generation_queue'",
				)
				.all();
			expect(tables).toHaveLength(1);
		});

		it("should create generations table", () => {
			const db = initDatabase();
			const tables = db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='generations'",
				)
				.all();
			expect(tables).toHaveLength(1);
		});

		it("should record migration version", () => {
			const db = initDatabase();
			const version = db
				.prepare("SELECT MAX(version) as version FROM schema_version")
				.get() as { version: number };
			expect(version.version).toBe(1);
		});

		it("should return same instance on multiple calls", () => {
			const db1 = initDatabase();
			const db2 = initDatabase();
			expect(db1).toBe(db2);
		});
	});

	describe("getDatabase", () => {
		it("should throw if database not initialized", () => {
			expect(() => getDatabase()).toThrow("Database not initialized");
		});

		it("should return database after initialization", () => {
			initDatabase();
			const db = getDatabase();
			expect(db).toBeDefined();
			expect(db.open).toBe(true);
		});
	});

	describe("closeDatabase", () => {
		it("should close database connection", () => {
			const db = initDatabase();
			expect(db.open).toBe(true);
			closeDatabase();
			expect(db.open).toBe(false);
		});

		it("should allow re-initialization after close", () => {
			initDatabase();
			closeDatabase();
			const db = initDatabase();
			expect(db.open).toBe(true);
		});
	});

	describe("recovery on startup", () => {
		it("should reset generating items to pending on init", () => {
			// First init - create a generating item
			let db = initDatabase();
			db.prepare(
				"INSERT INTO generation_queue (id, status, request, created_at, started_at) VALUES (?, ?, ?, ?, ?)",
			).run("test-1", "generating", "{}", Date.now(), Date.now());

			// Verify it's generating
			const before = db.prepare("SELECT status FROM generation_queue WHERE id = ?").get("test-1") as { status: string };
			expect(before.status).toBe("generating");

			// Close and re-init (simulates restart)
			closeDatabase();
			db = initDatabase();

			// Should be reset to pending
			const after = db.prepare("SELECT status FROM generation_queue WHERE id = ?").get("test-1") as { status: string };
			expect(after.status).toBe("pending");
		});
	});
});
