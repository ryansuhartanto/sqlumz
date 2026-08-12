// oxlint-disable vitest/valid-title
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { configure, reset } from "@logtape/logtape";
import type { LogRecord } from "@logtape/logtape";
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

	it("writes a typed skeleton for ts, defaulting to CommonJS with no surrounding package.json", async () => {
		const created = await generate({
			format: "ts",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(basename(created)).toBe(`${STAMP}-a.ts`);
		expect(contents).toContain(`import type { UmzugContext } from "sqlumz";`);
		expect(contents).toContain("exports.up = async function up(");
		expect(contents).toContain("exports.down = async function down(");
	});

	it("writes a jsdoc-annotated skeleton for js, defaulting to CommonJS with no surrounding package.json", async () => {
		const created = await generate({
			format: "js",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(basename(created)).toBe(`${STAMP}-a.js`);
		expect(contents).toContain("exports.up = async function up(");
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

	it.each(["js", "ts", "mjs", "cjs", "mts", "cts"] as const)(
		"writes a %s file with the matching extension",
		async (format) => {
			const created = await generate({ format, name: "a", targetPath: root });

			expect(basename(created)).toBe(`${STAMP}-a.${format}`);
		},
	);

	it("writes CommonJS exports for cjs, not export syntax", async () => {
		const created = await generate({
			format: "cjs",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(contents).toContain("exports.up = async function up(");
		expect(contents).toContain("exports.down = async function down(");
		expect(contents).not.toContain("export async function");
	});

	it("writes typed exports for cts using CommonJS syntax", async () => {
		const created = await generate({
			format: "cts",
			name: "a",
			targetPath: root,
		});
		const contents = await readFile(created, "utf8");

		expect(contents).toContain(`import type { UmzugContext } from "sqlumz";`);
		expect(contents).toContain("exports.up = async function up(");
		expect(contents).not.toContain("export async function");
	});

	it("writes ESM for mjs regardless of the surrounding package.json", async () => {
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ type: "commonjs" }),
		);

		const targetPath = join(root, "migrations");
		const created = await generate({
			format: "mjs",
			name: "a",
			targetPath,
		});
		const contents = await readFile(created, "utf8");

		expect(contents).toContain("export async function up(");
	});

	it("writes ESM for js when the nearest package.json has type module", async () => {
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ type: "module" }),
		);

		const targetPath = join(root, "migrations");
		const created = await generate({ format: "js", name: "a", targetPath });
		const contents = await readFile(created, "utf8");

		expect(contents).toContain("export async function up(");
	});

	it.each([{ type: "commonjs" }, {}])(
		"writes CommonJS for js when the nearest package.json is %j",
		async (pkg) => {
			await writeFile(join(root, "package.json"), JSON.stringify(pkg));

			const targetPath = join(root, "migrations");
			const created = await generate({ format: "js", name: "a", targetPath });
			const contents = await readFile(created, "utf8");

			expect(contents).toContain("exports.up = async function up(");
			expect(contents).not.toContain("export async function");
		},
	);

	describe("empty slug", () => {
		it("uses the prefix alone with no trailing dash when emptyName is silent", async () => {
			const created = await generate({
				format: "ts",
				name: "!!!",
				emptyName: "silent",
				targetPath: root,
			});

			expect(basename(created)).toBe(`${STAMP}.ts`);
		});

		it("uses the prefix alone for the sql directory name", async () => {
			const created = await generate({
				format: "sql",
				name: "!!!",
				emptyName: "silent",
				targetPath: root,
			});

			expect(basename(created)).toBe(STAMP);
		});

		it("rejects and creates nothing, not even the target folder, when emptyName is error", async () => {
			const targetPath = join(root, "migrations");

			await expect(
				generate({
					format: "ts",
					name: "!!!",
					emptyName: "error",
					targetPath,
				}),
			).rejects.toThrow(/empty string/);

			await expect(readdir(root)).resolves.toStrictEqual([]);
		});

		async function captureLogs(
			fn: () => Promise<unknown>,
		): Promise<LogRecord[]> {
			const records: LogRecord[] = [];

			await configure({
				sinks: { capture: (record) => records.push(record) },
				loggers: [
					{ category: ["sqlumz"], lowestLevel: "debug", sinks: ["capture"] },
				],
			});

			try {
				await fn();
			} finally {
				await reset();
			}

			return records;
		}

		it("still produces the file and logs a warning when emptyName is warn (the default)", async () => {
			let created = "";
			const records = await captureLogs(async () => {
				created = await generate({
					format: "ts",
					name: "!!!",
					targetPath: root,
				});
			});

			expect(basename(created)).toBe(`${STAMP}.ts`);
			expect(
				records.some(
					(record) => record.category.join(".") === "sqlumz.generate",
				),
			).toBe(true);
		});

		it("logs nothing when emptyName is silent", async () => {
			const records = await captureLogs(async () => {
				await generate({
					format: "ts",
					name: "!!!",
					emptyName: "silent",
					targetPath: root,
				});
			});

			expect(
				records.some(
					(record) => record.category.join(".") === "sqlumz.generate",
				),
			).toBe(false);
		});

		it("leaves a normal name unaffected", async () => {
			const created = await generate({
				format: "ts",
				name: "a",
				emptyName: "silent",
				targetPath: root,
			});

			expect(basename(created)).toBe(`${STAMP}-a.ts`);
		});
	});
});
