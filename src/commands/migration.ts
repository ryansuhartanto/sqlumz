import { command, constant, message, object, or, text } from "@optique/core";
import type { InferValue } from "@optique/core";
import { print } from "@optique/run";

import { generateCommand, stepOptions } from "#/commands/shared";
import type { ConfigValues } from "#/commands/shared";
import { generate } from "#/generate";
import { run, status, undo } from "#/umzug";

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
function undoTarget(to: string | undefined): string | 0 | undefined {
	return to === "0" ? 0 : to;
}

/** Two independent flags collapse into one mutually exclusive umzug option. */
function migrateOptions<TTo extends string | 0>(
	to: TTo | undefined,
	step: number | undefined,
): { to: TTo } | { step: number } | Record<string, never> {
	if (to !== undefined && step !== undefined) {
		throw new Error(`Pass either "--to" or "--step", not both.`);
	}

	if (to !== undefined) {
		return { to };
	}

	if (step !== undefined) {
		return { step };
	}

	return {};
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
					...migrateOptions(result.to, result.step),
				}),
				"Nothing to run.",
			);

			return;

		case "migration:undo":
			printNames(
				await undo({
					sequelizeOptions,
					migrationsPath,
					...migrateOptions(undoTarget(result.to), result.step),
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
