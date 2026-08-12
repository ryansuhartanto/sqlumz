import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getCurrentTimestamp, nextSequence, slugify } from "#/utils";

export type MigrationFormat = "sql" | "typescript" | "esm";

export type MigrationNaming = "timestamp" | "sequence";

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
-- Needs triggers, procedures, or semicolons inside strings? Use a .ts/.mjs migration.
`;

const TYPESCRIPT_SKELETON = `import type { UmzugContext } from "sqlumz";

export async function up({ sequelize }: UmzugContext): Promise<void> {
}

export async function down({ sequelize }: UmzugContext): Promise<void> {
}
`;

const ESM_SKELETON = `/** @type {import("sqlumz").MigrationFunction} */
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

	const file = join(
		targetPath,
		format === "typescript" ? `${base}.ts` : `${base}.mjs`,
	);

	await writeFile(
		file,
		format === "typescript" ? TYPESCRIPT_SKELETON : ESM_SKELETON,
	);

	return file;
}
