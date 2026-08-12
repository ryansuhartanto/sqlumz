// oxlint-disable vitest/valid-title
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";

import { generate } from "#/generate";
import { resolveMigrations } from "#/migrations";
import type { UmzugContext } from "#/migrations";

let folder: string;

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), "sqlumz-migrations-"));
});

afterEach(async () => {
	await rm(folder, { force: true, recursive: true });
});

function stubContext() {
	const transaction = Symbol("transaction");
	const query = vi.fn();

	const sequelize = {
		query,
		transaction: vi.fn(async (fn: (t: unknown) => Promise<void>) =>
			fn(transaction),
		),
	};

	return {
		query,
		transaction,
		context: { sequelize } as unknown as UmzugContext,
	};
}

function params(name: string, context: UmzugContext) {
	return { name, context };
}

async function names(): Promise<string[]> {
	const migrations = await resolveMigrations(folder);

	return migrations.map((migration) => migration.name);
}

describe(resolveMigrations, () => {
	it("throws with the path when the folder is missing", async () => {
		const missing = join(folder, "nope");

		await expect(resolveMigrations(missing)).rejects.toThrow(missing);
	});

	it("sorts by name", async () => {
		for (const name of [
			"0000000003-c.sql",
			"0000000001-a.sql",
			"0000000002-b.sql",
		]) {
			await writeFile(join(folder, name), "SELECT 1;");
		}

		await expect(names()).resolves.toStrictEqual([
			"0000000001-a.sql",
			"0000000002-b.sql",
			"0000000003-c.sql",
		]);
	});

	it("excludes unrecognized files and directories without an up file", async () => {
		await writeFile(join(folder, "notes.txt"), "");
		await writeFile(join(folder, "readme.md"), "");
		await mkdir(join(folder, "empty-dir"));

		await expect(names()).resolves.toStrictEqual([]);
	});

	it.each([".js", ".ts", ".cjs", ".mjs", ".cts", ".mts"])(
		"recognizes %s",
		async (extension) => {
			await writeFile(join(folder, `0000000001-a${extension}`), "");

			await expect(names()).resolves.toStrictEqual([
				`0000000001-a${extension}`,
			]);
		},
	);

	it("resolves files, directories and scripts together", async () => {
		await writeFile(join(folder, "0000000001-a.sql"), "SELECT 1;");
		await mkdir(join(folder, "0000000002-b"));
		await writeFile(join(folder, "0000000002-b", "up.sql"), "SELECT 1;");
		await writeFile(
			join(folder, "0000000003-c.mjs"),
			"export const up = () => {};",
		);

		await expect(names()).resolves.toStrictEqual([
			"0000000001-a.sql",
			"0000000002-b",
			"0000000003-c.mjs",
		]);
	});

	it("runs every statement of a multi-statement sql file in one transaction", async () => {
		await writeFile(
			join(folder, "0000000001-a.sql"),
			"CREATE TABLE a (id INT); CREATE TABLE b (id INT);",
		);

		const { context, query, transaction } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await migration!.up(params("0000000001-a.sql", context));

		expect(query.mock.calls).toStrictEqual([
			["CREATE TABLE a (id INT)", { transaction }],
			["CREATE TABLE b (id INT)", { transaction }],
		]);
	});

	it("refuses to revert a bare sql file", async () => {
		await writeFile(join(folder, "0000000001-a.sql"), "SELECT 1;");

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await expect(
			migration!.down?.(params("0000000001-a.sql", context)),
		).rejects.toThrow("cannot be reverted");
	});

	it("resolves both directions of a directory migration", async () => {
		await mkdir(join(folder, "0000000001-a"));
		await writeFile(join(folder, "0000000001-a", "up.sql"), "SELECT 1;");
		await writeFile(join(folder, "0000000001-a", "down.sql"), "SELECT 2;");

		const { context, query, transaction } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await migration!.up(params("0000000001-a", context));
		await migration!.down?.(params("0000000001-a", context));

		expect(query.mock.calls).toStrictEqual([
			["SELECT 1", { transaction }],
			["SELECT 2", { transaction }],
		]);
	});

	it("refuses to revert a directory migration without down.sql", async () => {
		await mkdir(join(folder, "0000000001-a"));
		await writeFile(join(folder, "0000000001-a", "up.sql"), "SELECT 1;");

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await expect(
			migration!.down?.(params("0000000001-a", context)),
		).rejects.toThrow("cannot be reverted");
	});

	it("calls named exports with the context only", async () => {
		const calls: unknown[][] = [];
		(globalThis as Record<string, unknown>)["sqlumzCalls"] = calls;

		await writeFile(
			join(folder, "0000000001-a.mjs"),
			`export async function up(...args) { globalThis.sqlumzCalls.push(["up", ...args]); }
			export async function down(...args) { globalThis.sqlumzCalls.push(["down", ...args]); }`,
		);

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await migration!.up(params("0000000001-a.mjs", context));
		await migration!.down?.(params("0000000001-a.mjs", context));

		expect(calls).toStrictEqual([
			["up", context],
			["down", context],
		]);
	});

	it("resolves commonjs exports", async () => {
		await writeFile(
			join(folder, "0000000001-a.cjs"),
			`module.exports = { up: async () => {}, down: async () => {} };`,
		);

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await expect(
			migration!.up(params("0000000001-a.cjs", context)),
		).resolves.toBeUndefined();
		await expect(
			migration!.down?.(params("0000000001-a.cjs", context)),
		).resolves.toBeUndefined();
	});

	it("resolves a default export object", async () => {
		await writeFile(
			join(folder, "0000000001-a.mjs"),
			`export default { up: async () => {}, down: async () => {} };`,
		);

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await expect(
			migration!.up(params("0000000001-a.mjs", context)),
		).resolves.toBeUndefined();
		await expect(
			migration!.down?.(params("0000000001-a.mjs", context)),
		).resolves.toBeUndefined();
	});

	it("throws when an export is not callable", async () => {
		await writeFile(join(folder, "0000000001-a.mjs"), `export const up = 1;`);

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		await expect(
			migration!.up(params("0000000001-a.mjs", context)),
		).rejects.toThrow(TypeError);
	});

	it("loads a scaffolded cjs migration end to end", async () => {
		const created = await generate({
			format: "cjs",
			name: "a",
			targetPath: folder,
		});

		const { context } = stubContext();
		const [migration] = await resolveMigrations(folder);

		expect(created).toBe(join(folder, migration!.name));
		await expect(
			migration!.up(params(migration!.name, context)),
		).resolves.toBeUndefined();
		await expect(
			migration!.down?.(params(migration!.name, context)),
		).resolves.toBeUndefined();
	});
});
