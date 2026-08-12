import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Sequelize } from "@sequelize/core";
import type { RunnableMigration } from "umzug";

import { splitSql } from "#/utils";

export type UmzugContext = {
	sequelize: Sequelize;
};

export type MigrationFunction = (context: UmzugContext) => Promise<void>;

const JS_EXTENSIONS = new Set([".js", ".ts", ".cjs", ".mjs", ".cts", ".mts"]);

async function runSqlFile(sequelize: Sequelize, file: string): Promise<void> {
	const contents = await readFile(file, "utf8");

	await sequelize.transaction(async (transaction) => {
		for (const statement of splitSql(contents)) {
			await sequelize.query(statement, { transaction });
		}
	});
}

async function loadMigrationExport(
	file: string,
	name: string,
	key: "up" | "down",
): Promise<MigrationFunction> {
	// pathToFileURL: bare paths break import() on Windows and on names containing "#"
	const module = (await import(pathToFileURL(file).href)) as Record<
		string,
		unknown
	> & { default?: Record<string, unknown> };

	const fn = module[key] ?? module.default?.[key];

	if (typeof fn !== "function") {
		throw new TypeError(`Migration "${name}" has no callable "${key}" export.`);
	}

	return fn as MigrationFunction;
}

function sqlMigration(
	name: string,
	upFile: string,
	downFile?: string,
): RunnableMigration<UmzugContext> {
	return {
		name,
		up: async ({ context }) => runSqlFile(context.sequelize, upFile),
		down: async ({ context }) => {
			if (!downFile) {
				throw new Error(
					`Migration "${name}" cannot be reverted (no down.sql).`,
				);
			}

			return runSqlFile(context.sequelize, downFile);
		},
	};
}

function jsMigration(
	name: string,
	file: string,
): RunnableMigration<UmzugContext> {
	return {
		name,
		up: async ({ context }) =>
			(await loadMigrationExport(file, name, "up"))(context),
		down: async ({ context }) =>
			(await loadMigrationExport(file, name, "down"))(context),
	};
}

export async function resolveMigrations(
	folder: string,
): Promise<Array<RunnableMigration<UmzugContext>>> {
	let entries;

	try {
		entries = await readdir(folder, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Migrations folder not found: ${folder}`, {
				cause: error,
			});
		}

		throw error;
	}

	entries.sort((a, b) => a.name.localeCompare(b.name));

	const migrations: Array<RunnableMigration<UmzugContext>> = [];

	for (const entry of entries) {
		const path = join(folder, entry.name);

		if (entry.isDirectory()) {
			const files = new Set(await readdir(path));

			if (files.has("up.sql")) {
				migrations.push(
					sqlMigration(
						entry.name,
						join(path, "up.sql"),
						files.has("down.sql") ? join(path, "down.sql") : undefined,
					),
				);
			}

			continue;
		}

		const extension = extname(entry.name);

		if (extension === ".sql") {
			migrations.push(sqlMigration(entry.name, path));
		} else if (JS_EXTENSIONS.has(extension)) {
			migrations.push(jsMigration(entry.name, path));
		}
	}

	return migrations;
}
