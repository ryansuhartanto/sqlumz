import { command, constant, message, object, or, text } from "@optique/core";
import type { InferValue } from "@optique/core";
import { print } from "@optique/run";

import { generateCommand, stepOptions } from "#/commands/shared";
import type { ConfigValues } from "#/commands/shared";
import { generate } from "#/generate";
import { run, status, undo } from "#/umzug";
import type { UndoOptions } from "#/umzug";

export const migrationCommand = command(
	"migration",
	or(
		command(
			"run",
			object({ action: constant("migration:run"), ...stepOptions() }),
			{ description: message`Apply pending migrations` },
		),
		command(
			"undo",
			object({ action: constant("migration:undo"), ...stepOptions() }),
			{ description: message`Revert executed migrations` },
		),
		command("status", object({ action: constant("migration:status") }), {
			description: message`Show executed and pending migrations`,
		}),
		generateCommand("migration:generate", message`Scaffold a new migration`),
	),
	{ description: message`Manage migrations` },
);

export type MigrationResult = InferValue<typeof migrationCommand>;

/** `--to 0` reverts everything; umzug spells that as the number `0`. */
function undoTarget(to: string | undefined): UndoOptions["to"] {
	return to === "0" ? 0 : to;
}

function printNames(names: Array<{ name: string }>, empty: string): void {
	if (names.length === 0) {
		print(message`${text(empty)}`);
		return;
	}

	for (const { name } of names) {
		print(message`${text(name)}`);
	}
}

export async function executeMigration(
	result: MigrationResult & ConfigValues,
): Promise<void> {
	const { migrationsPath } = result;
	const sequelizeOptions = result.sequelize.options;

	switch (result.action) {
		case "migration:run":
			printNames(
				await run({
					sequelizeOptions,
					migrationsPath,
					to: result.to,
					step: result.step,
				}),
				"Nothing to run.",
			);

			return;

		case "migration:undo":
			printNames(
				await undo({
					sequelizeOptions,
					migrationsPath,
					to: undoTarget(result.to),
					step: result.step,
				}),
				"Nothing to undo.",
			);

			return;

		case "migration:status": {
			const { executed, pending } = await status({
				sequelizeOptions,
				migrationsPath,
			});

			print(message`Executed:`);
			printNames(executed, "  (none)");
			print(message`Pending:`);
			printNames(pending, "  (none)");

			return;
		}

		case "migration:generate": {
			const created = await generate({
				format: result.formatOverride ?? result.format,
				name: result.name,
				naming: result.naming,
				targetPath: migrationsPath,
			});

			print(message`${text(created)}`);
		}
	}
}
