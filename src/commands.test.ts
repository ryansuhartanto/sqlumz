// oxlint-disable vitest/valid-title
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSync } from "@optique/core";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { commands, execute } from "#/commands";
import type { CommandResult } from "#/commands";
import type { ConfigResult } from "#/config";

let root: string;
let raw: ConfigResult;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "sqlumz-commands-"));

	raw = {
		config: {
			naming: "sequence",
			path: { migrations: "migrations", seeds: "seeds" },
		},
		meta: { configDir: root, configPath: join(root, "sqlumz.config.ts") },
	};
});

afterEach(async () => {
	await rm(root, { force: true, recursive: true });
});

function parse(args: string[]): CommandResult {
	const result = parseSync(commands, args);

	if (!result.success) {
		throw new Error(JSON.stringify(result.error));
	}

	return result.value;
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
			{ action: "migration:generate", name: "add users", format: "ts" },
		],
		[
			["seed", "generate", "--name", "a", "--format", "sql"],
			{ action: "seed:generate", name: "a", format: "sql" },
		],
	])("parses %j", (args, expected) => {
		expect(parse(args)).toMatchObject(expected);
	});

	it("rejects generate without a name", () => {
		expect(parseSync(commands, ["seed", "generate"]).success).toBe(false);
	});
});

describe(execute, () => {
	it("scaffolds into the migrations path", async () => {
		await execute(parse(["migration", "generate", "--name", "add users"]), raw);

		await expect(readdir(join(root, "migrations"))).resolves.toStrictEqual([
			"0000000001-add-users.ts",
		]);
	});

	it("scaffolds into the seeds path", async () => {
		await execute(
			parse(["seed", "generate", "--name", "a", "--format", "sql"]),
			raw,
		);

		await expect(
			readdir(join(root, "seeds", "0000000001-a")),
		).resolves.toStrictEqual(["down.sql", "up.sql"]);
	});
});
