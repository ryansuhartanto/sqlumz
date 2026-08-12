// oxlint-disable vitest/valid-title
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AbstractDialect, Options } from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createUmzug, run, status, undo } from "#/umzug";

const TABLES = ["alpha", "beta", "gamma"];

let root: string;
let options: {
	sequelizeOptions: Options<AbstractDialect>;
	migrationsPath: string;
	logger: undefined;
};

const names = TABLES.map(
	(table, index) => `${String(index + 1).padStart(10, "0")}-create-${table}`,
);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "sqlumz-umzug-"));

	const migrationsPath = join(root, "migrations");
	await mkdir(migrationsPath);

	await Promise.all(
		names.map(async (name, index) => {
			const folder = join(migrationsPath, name);
			const table = TABLES[index];

			await mkdir(folder);
			await writeFile(
				join(folder, "up.sql"),
				`CREATE TABLE ${table} (id INTEGER PRIMARY KEY);`,
			);
			await writeFile(join(folder, "down.sql"), `DROP TABLE ${table};`);
		}),
	);

	options = {
		sequelizeOptions: {
			dialect: SqliteDialect,
			storage: join(root, "test.sqlite3"),
		} as Options<AbstractDialect>,
		migrationsPath,
		logger: undefined,
	};
});

afterEach(async () => {
	await rm(root, { force: true, recursive: true });
});

async function existingTables(): Promise<string[]> {
	const { sequelize } = await createUmzug(options);

	try {
		const [rows] = await sequelize.query(
			"SELECT name FROM sqlite_master WHERE type = 'table'",
		);

		return (rows as Array<{ name: string }>)
			.map((row) => row.name)
			.filter((name) => TABLES.includes(name))
			.toSorted();
	} finally {
		await sequelize.close();
	}
}

function applied(migrations: Array<{ name: string }>): string[] {
	return migrations.map((migration) => migration.name);
}

describe(createUmzug, () => {
	it("refuses to run without a configured database", async () => {
		await expect(
			createUmzug({ ...options, sequelizeOptions: undefined }),
		).rejects.toThrow("No database configured");
	});
});

describe(run, () => {
	it("applies every pending migration and creates the tables", async () => {
		expect(applied(await run(options))).toStrictEqual(names);
		await expect(existingTables()).resolves.toStrictEqual(TABLES.toSorted());
	});

	it("is a no-op on a second run", async () => {
		await run(options);

		expect(applied(await run(options))).toStrictEqual([]);
	});

	it("stops after `step` migrations", async () => {
		expect(applied(await run({ ...options, step: 2 }))).toStrictEqual(
			names.slice(0, 2),
		);
	});

	it("stops at `to` inclusive", async () => {
		expect(applied(await run({ ...options, to: names[1] }))).toStrictEqual(
			names.slice(0, 2),
		);
	});

	it("rejects `to` together with `step`", async () => {
		await expect(run({ ...options, to: names[1], step: 1 })).rejects.toThrow(
			"not both",
		);
	});
});

describe(undo, () => {
	beforeEach(async () => {
		await run(options);
	});

	it("reverts only the last migration by default", async () => {
		expect(applied(await undo(options))).toStrictEqual(names.slice(-1));
	});

	it("reverts `step` migrations in reverse order", async () => {
		expect(applied(await undo({ ...options, step: 2 }))).toStrictEqual(
			names.toReversed().slice(0, 2),
		);
	});

	it("reverts everything with `to: 0`", async () => {
		expect(applied(await undo({ ...options, to: 0 }))).toStrictEqual(
			names.toReversed(),
		);
		await expect(existingTables()).resolves.toStrictEqual([]);
	});

	it("reverts down to `to` inclusive", async () => {
		expect(applied(await undo({ ...options, to: names[1] }))).toStrictEqual(
			names.toReversed().slice(0, 2),
		);
	});

	it("rejects `to` together with `step`", async () => {
		await expect(undo({ ...options, to: names[1], step: 1 })).rejects.toThrow(
			"not both",
		);
	});
});

describe(status, () => {
	it("reports everything as pending before the first run", async () => {
		const { executed, pending } = await status(options);

		expect(applied(executed)).toStrictEqual([]);
		expect(applied(pending)).toStrictEqual(names);
	});

	it("splits executed from pending", async () => {
		await run({ ...options, step: 2 });
		const { executed, pending } = await status(options);

		expect(applied(executed)).toStrictEqual(names.slice(0, 2));
		expect(applied(pending)).toStrictEqual(names.slice(2));
	});

	it("reports nothing pending after a full run", async () => {
		await run(options);
		const { executed, pending } = await status(options);

		expect(applied(executed)).toStrictEqual(names);
		expect(applied(pending)).toStrictEqual([]);
	});
});
