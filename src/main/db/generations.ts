// ABOUTME: Generation history database operations
// ABOUTME: Record and query completed generations

import { getDatabase } from "./database";
import type { GenerationRecord } from "../../shared/types";

// SQLite row type for generations table
interface GenerationRow {
	id: string;
	theme_id: string | null;
	template_id: string | null;
	template_values: string | null;
	prompt: string;
	negative_prompt: string | null;
	seed: number;
	output_path: string;
	model: string;
	width: number;
	height: number;
	steps: number;
	cfg_scale: number;
	generation_time_ms: number | null;
	created_at: number;
}

// Convert database row to GenerationRecord
const rowToGenerationRecord = (row: GenerationRow): GenerationRecord => ({
	id: row.id,
	themeId: row.theme_id,
	templateId: row.template_id,
	templateValues: row.template_values
		? (JSON.parse(row.template_values) as Record<string, string>)
		: null,
	prompt: row.prompt,
	negativePrompt: row.negative_prompt,
	seed: row.seed,
	outputPath: row.output_path,
	model: row.model,
	width: row.width,
	height: row.height,
	steps: row.steps,
	cfgScale: row.cfg_scale,
	generationTimeMs: row.generation_time_ms,
	createdAt: row.created_at,
});

export const recordGeneration = (record: GenerationRecord): void => {
	const db = getDatabase();

	db.prepare(
		`INSERT INTO generations (
			id, theme_id, template_id, template_values, prompt, negative_prompt,
			seed, output_path, model, width, height, steps, cfg_scale,
			generation_time_ms, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		record.id,
		record.themeId,
		record.templateId,
		record.templateValues ? JSON.stringify(record.templateValues) : null,
		record.prompt,
		record.negativePrompt,
		record.seed,
		record.outputPath,
		record.model,
		record.width,
		record.height,
		record.steps,
		record.cfgScale,
		record.generationTimeMs,
		record.createdAt,
	);
};

export const getGeneration = (id: string): GenerationRecord | null => {
	const db = getDatabase();
	const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as
		| GenerationRow
		| undefined;

	if (!row) return null;
	return rowToGenerationRecord(row);
};

export interface ListGenerationsOptions {
	themeId?: string;
	templateId?: string;
	limit?: number;
	offset?: number;
}

export const listGenerations = (options?: ListGenerationsOptions): GenerationRecord[] => {
	const db = getDatabase();

	let sql = "SELECT * FROM generations WHERE 1=1";
	const params: (string | number)[] = [];

	if (options?.themeId) {
		sql += " AND theme_id = ?";
		params.push(options.themeId);
	}

	if (options?.templateId) {
		sql += " AND template_id = ?";
		params.push(options.templateId);
	}

	sql += " ORDER BY created_at DESC";

	if (options?.limit) {
		sql += " LIMIT ?";
		params.push(options.limit);
	}

	if (options?.offset) {
		sql += " OFFSET ?";
		params.push(options.offset);
	}

	const rows = db.prepare(sql).all(...params) as GenerationRow[];
	return rows.map(rowToGenerationRecord);
};

export const countGenerations = (options?: {
	themeId?: string;
	templateId?: string;
}): number => {
	const db = getDatabase();

	let sql = "SELECT COUNT(*) as count FROM generations WHERE 1=1";
	const params: string[] = [];

	if (options?.themeId) {
		sql += " AND theme_id = ?";
		params.push(options.themeId);
	}

	if (options?.templateId) {
		sql += " AND template_id = ?";
		params.push(options.templateId);
	}

	const result = db.prepare(sql).get(...params) as { count: number };
	return result.count;
};

export const deleteGeneration = (id: string): boolean => {
	const db = getDatabase();
	const result = db.prepare("DELETE FROM generations WHERE id = ?").run(id);
	return result.changes > 0;
};
