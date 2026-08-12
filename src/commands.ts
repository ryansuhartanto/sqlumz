import { group, or } from "@optique/core";
import type { InferValue } from "@optique/core";

import { initCommand } from "#/commands/init";
import { executeMigration, migrationCommand } from "#/commands/migration";
import { executeSeed, seedCommand } from "#/commands/seed";
import type { ConfigResult } from "#/config";

export const commands = group(
	"Commands",
	or(initCommand, migrationCommand, seedCommand),
);

export type CommandResult = InferValue<typeof commands>;

export async function execute(
	result: CommandResult,
	raw: ConfigResult,
): Promise<void> {
	switch (result.action) {
		case "init":
			return;

		case "migration:run":
		case "migration:undo":
		case "migration:status":
		case "migration:generate":
			return executeMigration(result, raw);

		case "seed:generate":
			return executeSeed(result, raw);
	}
}
