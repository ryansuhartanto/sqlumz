import {
	flag,
	group,
	map,
	merge,
	multiple,
	nonEmpty,
	object,
	option,
	optional,
	or,
} from "@optique/core";
import type { InferValue } from "@optique/core";
import { path } from "@optique/run";

import { initCommand } from "#/commands/init";
import { executeMigration, migrationCommand } from "#/commands/migration";
import { executeSeed, seedCommand } from "#/commands/seed";
import { configOptions } from "#/commands/shared";

const globals = object(
	{
		config: optional(option("-c", "--config", path({ metavar: "CONFIG" }))),
		verbosity: map(multiple(flag("-v", "--verbose")), (flags) => flags.length),
	},
	{ hidden: "usage" },
);

export const commands = group(
	"Commands",
	or(initCommand, migrationCommand, seedCommand),
);

export const parser = merge(
	group("Global flags", globals),
	configOptions,
	nonEmpty(commands),
);

export type CliResult = InferValue<typeof parser>;

export async function execute(result: CliResult): Promise<void> {
	switch (result.action) {
		case "init":
			return;

		case "migration:run":
		case "migration:undo":
		case "migration:status":
		case "migration:generate":
			return executeMigration(result);

		case "seed:generate":
			return executeSeed(result);
	}
}
