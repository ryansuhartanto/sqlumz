import {
	group,
	merge,
	nonEmpty,
	object,
	option,
	optional,
	or,
} from "@optique/core";
import type { InferValue } from "@optique/core";
import { loggingOptions } from "@optique/logtape";
import { path } from "@optique/run";

import { executeInit, initCommand } from "#/commands/init";
import {
	executeResource,
	migrationCommand,
	seedCommand,
} from "#/commands/resource";
import { configOptions } from "#/commands/shared";

/** Seeds get their own storage table so they do not read as pending migrations. */
const SEED_MODEL = "SequelizeData";

const globals = object(
	{
		config: optional(option("-c", "--config", path({ metavar: "CONFIG" }))),
		logging: loggingOptions({ level: "verbosity" }),
	},
	{ hidden: "usage" },
);
const commands = nonEmpty(
	merge(configOptions, or(migrationCommand, seedCommand)),
);

export const parser = merge(
	group("Global flags", globals),
	or(group("Initialize", initCommand), group("Commands", commands)),
);

export type CliResult = InferValue<typeof parser>;

export async function execute(result: CliResult): Promise<void> {
	switch (result.action) {
		case "init":
			return executeInit();

		case "migration":
			return executeResource(result, { folder: result.migrationsPath });

		case "seed":
			return executeResource(result, {
				folder: result.seedsPath,
				modelName: SEED_MODEL,
			});
	}
}
