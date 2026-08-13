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

export const commands = group(
	"Commands",
	or(initCommand, migrationCommand, seedCommand),
);

// `init` is deliberately outside `configOptions`: bindConfig fails the whole
// parse when no config file exists, which is exactly the case `init` exists to
// resolve. Every other command may keep requiring one.
export const parser = or(
	merge(group("Global flags", globals), initCommand),
	merge(
		group("Global flags", globals),
		configOptions,
		nonEmpty(group("Commands", or(migrationCommand, seedCommand))),
	),
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
