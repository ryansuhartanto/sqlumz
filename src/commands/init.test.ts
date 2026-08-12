// oxlint-disable vitest/valid-title
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { executeInit } from "#/commands/init";
import { loadConfig } from "#/config";

let root: string;
let cwd: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "sqlumz-init-"));
	cwd = process.cwd();
	process.chdir(root);

	// symlinked so `import "sqlumz"` / `require("sqlumz")` in the generated
	// config resolves the same way it would for a real installed dependency
	await mkdir(join(root, "node_modules"), { recursive: true });
	await symlink(
		resolve(import.meta.dirname, "../.."),
		join(root, "node_modules", "sqlumz"),
		"dir",
	);
});

afterEach(async () => {
	process.chdir(cwd);
	await rm(root, { force: true, recursive: true });
});

describe(executeInit, () => {
	it("writes a config that loadConfig can load back, unchanged", async () => {
		await executeInit();

		const result = await loadConfig({});

		expect(result?.config).toMatchObject({
			sequelize: { dialect: "sqlite3" },
		});
	});

	it("does not overwrite an existing config", async () => {
		await executeInit();
		const before = await readFile(join(root, "sqlumz.config.ts"), "utf8");

		await executeInit();
		const after = await readFile(join(root, "sqlumz.config.ts"), "utf8");

		expect(after).toBe(before);
	});

	it("emits require()/module.exports for a CommonJS project", async () => {
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ name: "consumer", type: "commonjs" }),
		);

		await executeInit();

		const written = await readFile(join(root, "sqlumz.config.ts"), "utf8");

		expect(written).toContain('require("sqlumz")');
		await expect(loadConfig({})).resolves.toMatchObject({
			config: { sequelize: { dialect: "sqlite3" } },
		});
	});

	it("emits import/export default for an ESM project", async () => {
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ name: "consumer", type: "module" }),
		);

		await executeInit();

		const written = await readFile(join(root, "sqlumz.config.ts"), "utf8");

		expect(written).toContain('import { defineConfig } from "sqlumz"');
		await expect(loadConfig({})).resolves.toMatchObject({
			config: { sequelize: { dialect: "sqlite3" } },
		});
	});
});
