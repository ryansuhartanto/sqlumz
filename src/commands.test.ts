// oxlint-disable vitest/valid-title
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run as runCli } from "@optique/run";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { execute, parser } from "#/commands";
import type { CliResult } from "#/commands";
import { configContext } from "#/config";
import type { Config } from "#/config";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "sqlumz-commands-"));
});

afterEach(async () => {
	await rm(root, { force: true, recursive: true });
});

/** Drives the real parser, resolving config through the context the CLI uses. */
async function cli(args: string[], config: Config = {}): Promise<CliResult> {
	const diagnostics: string[] = [];

	return runCli(parser, {
		args,
		programName: "sqlumz",
		contexts: [configContext],
		contextOptions: {
			load: () => ({
				config,
				meta: { configPath: join(root, "sqlumz.config.ts"), configDir: root },
			}),
		},
		stderr: (text) => diagnostics.push(text),
		onExit: (code: number) => {
			throw new Error(`exited ${code}: ${diagnostics.join(" / ")}`);
		},
	});
}

describe("command parsing", () => {
	it.each([
		[["init"], { action: "init" }],
		[["migration", "status"], { action: "migration:status" }],
		[["migration", "run"], { action: "migration:run" }],
		[["migration", "run", "--step", "2"], { action: "migration:run", step: 2 }],
		[["migration", "undo", "--to", "0"], { action: "migration:undo", to: "0" }],
		[
			["migration", "generate", "--name", "add users"],
			{ action: "migration:generate", name: "add users" },
		],
		[
			["seed", "generate", "--name", "a", "--format", "sql"],
			{ action: "seed:generate", name: "a", formatOverride: "sql" },
		],
	])("parses %j", async (args, expected) => {
		await expect(cli(args)).resolves.toMatchObject(expected);
	});

	it("rejects generate without a name", async () => {
		await expect(cli(["seed", "generate"])).rejects.toThrow("exited");
	});
});

describe("config binding", () => {
	it("resolves paths against the config directory", async () => {
		await expect(cli(["migration", "status"])).resolves.toMatchObject({
			migrationsPath: join(root, "migrations"),
			seedsPath: join(root, "seeds"),
		});
	});

	it("honours overridden paths", async () => {
		const config = { path: { migrations: "db/up", seeds: "db/seed" } };

		await expect(cli(["migration", "status"], config)).resolves.toMatchObject({
			migrationsPath: join(root, "db/up"),
			seedsPath: join(root, "db/seed"),
		});
	});

	it("falls back to the schema default for naming", async () => {
		await expect(cli(["migration", "status"])).resolves.toMatchObject({
			naming: "timestamp",
		});
		await expect(
			cli(["migration", "status"], { naming: "sequence" }),
		).resolves.toMatchObject({ naming: "sequence" });
	});

	it("takes the scaffold format from the config", async () => {
		await expect(cli(["migration", "status"])).resolves.toMatchObject({
			format: "ts",
		});
		await expect(
			cli(["migration", "status"], { format: "js" }),
		).resolves.toMatchObject({ format: "js" });
	});

	it("survives an absent sequelize entry", async () => {
		const result = await cli(["migration", "status"]);

		expect(result.sequelize).toStrictEqual({ options: undefined });
	});

	it("passes a configured sequelize entry through", async () => {
		const config = { sequelize: { dialect: "postgres" } } as const;

		await expect(cli(["migration", "status"], config)).resolves.toMatchObject({
			sequelize: { options: { dialect: "postgres" } },
		});
	});
});

describe(execute, () => {
	it("lets --format override the configured format", async () => {
		const config = { format: "js", naming: "sequence" } as const;
		const generate = ["migration", "generate", "--name", "a"];

		await execute(await cli(generate, config));
		await execute(await cli([...generate, "--format", "ts"], config));

		await expect(readdir(join(root, "migrations"))).resolves.toStrictEqual([
			"0000000001-a.js",
			"0000000002-a.ts",
		]);
	});

	it("scaffolds into the migrations path", async () => {
		const config = { naming: "sequence" } as const;

		await execute(
			await cli(["migration", "generate", "--name", "add users"], config),
		);

		await expect(readdir(join(root, "migrations"))).resolves.toStrictEqual([
			"0000000001-add-users.ts",
		]);
	});

	it("scaffolds into the seeds path", async () => {
		const config = { naming: "sequence" } as const;

		await execute(
			await cli(["seed", "generate", "--name", "a", "--format", "sql"], config),
		);

		await expect(
			readdir(join(root, "seeds", "0000000001-a")),
		).resolves.toStrictEqual(["down.sql", "up.sql"]);
	});
});
