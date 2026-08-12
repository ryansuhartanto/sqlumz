import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import z from "zod";

import { getCurrentTimestamp, nextSequence, slugify } from "#/utils";

export const formatSchema = z.enum(["sql", "ts", "js"]);

export const namingSchema = z.enum(["timestamp", "sequence"]);

export type MigrationFormat = z.infer<typeof formatSchema>;

export type MigrationNaming = z.infer<typeof namingSchema>;

export type GenerateOptions = {
	format: MigrationFormat;
	name: string;
	/**
	 * `sequence` never changes its zero-pad width once migrations exist —
	 * widening it silently reorders history.
	 */
	naming?: MigrationNaming;
	targetPath: string;
};

const SQL_HEADER = `-- Split on ";" and run in one transaction.
-- Needs triggers, procedures, or semicolons inside strings? Use a .ts/.js migration.
`;

const TS_SKELETON = `import type { UmzugContext } from "sqlumz";

export async function up({ sequelize }: UmzugContext): Promise<void> {
}

export async function down({ sequelize }: UmzugContext): Promise<void> {
}
`;

const JS_SKELETON = `/** @type {import("sqlumz").MigrationFunction} */
export async function up({ sequelize }) {
}

/** @type {import("sqlumz").MigrationFunction} */
export async function down({ sequelize }) {
}
`;

export async function generate({
	format,
	name,
	naming = "timestamp",
	targetPath,
}: GenerateOptions): Promise<string> {
	await mkdir(targetPath, { recursive: true });

	const prefix =
		naming === "sequence"
			? nextSequence(await readdir(targetPath))
			: getCurrentTimestamp();

	const base = `${prefix}-${slugify(name)}`;

	if (format === "sql") {
		const folder = join(targetPath, base);

		await mkdir(folder);
		await Promise.all([
			writeFile(join(folder, "up.sql"), SQL_HEADER),
			writeFile(join(folder, "down.sql"), SQL_HEADER),
		]);

		return folder;
	}

	const file = join(targetPath, `${base}.${format}`);

	await writeFile(file, format === "ts" ? TS_SKELETON : JS_SKELETON);

	return file;
}
