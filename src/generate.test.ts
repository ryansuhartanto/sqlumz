// oxlint-disable vitest/valid-title
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";

import { generate } from "#/generate";

const STAMP = "201020123456";

let root: string;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2020-10-20T12:34:56.789Z"));

	root = await mkdtemp(join(tmpdir(), "sqlumz-generate-"));
});

afterEach(async () => {
	vi.useRealTimers();
	await rm(root, { force: true, recursive: true });
});

describe(generate, () => {
	it("creates a missing target folder", async () => {
		const targetPath = join(root, "migrations");

		await generate({ format: "ts", name: "a", targetPath });

		await expect(readdir(targetPath)).resolves.toStrictEqual([`${STAMP}-a.ts`]);
	});

	it("writes an up/down pair with the split warning for sql", async () => {
		const created = await generate({
			format: "sql",
			name: "create users table",
			targetPath: root,
		});

		expect(basename(created)).toBe(`${STAMP}-create-users-table`);
		await expect(readdir(created)).resolves.toStrictEqual([
			"down.sql",
			"up.sql",
		]);

		for (const file of ["up.sql", "down.sql"]) {
			await expect(readFile(join(created, file), "utf8")).resolves.toContain(
				`-- Split on ";" and run in one transaction.`,
			);
		}
	});

	it("writes a typed skeleton for ts", async () => {
		const created = await generate({
			format: "ts",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(basename(created)).toBe(`${STAMP}-a.ts`);
		expect(contents).toContain(`import type { UmzugContext } from "sqlumz";`);
		expect(contents).toContain("export async function up(");
		expect(contents).toContain("export async function down(");
	});

	it("writes a jsdoc-annotated skeleton for js", async () => {
		const created = await generate({
			format: "js",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(basename(created)).toBe(`${STAMP}-a.js`);
		expect(
			contents.match(/@type \{import\("sqlumz"\)\.MigrationFunction\}/g),
		).toHaveLength(2);
	});

	it("numbers from one and increments when naming is sequence", async () => {
		const first = await generate({
			format: "js",
			name: "a",
			naming: "sequence",
			targetPath: root,
		});
		const second = await generate({
			format: "js",
			name: "b",
			naming: "sequence",
			targetPath: root,
		});

		expect(basename(first)).toBe("0000000001-a.js");
		expect(basename(second)).toBe("0000000002-b.js");
	});
});
