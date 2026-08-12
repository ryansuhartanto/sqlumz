import { command, message, text } from "@optique/core";
import type { InferValue } from "@optique/core";
import { print } from "@optique/run";

import { generateCommand, targetPath } from "#/commands/shared";
import type { ConfigResult } from "#/config";
import { generate } from "#/generate";

export const seedCommand = command(
	"seed",
	generateCommand("seed:generate", message`Scaffold a new seed`),
	{ description: message`Manage seeds` },
);

export type SeedResult = InferValue<typeof seedCommand>;

export async function executeSeed(
	result: SeedResult,
	raw: ConfigResult,
): Promise<void> {
	const created = await generate({
		format: result.format,
		name: result.name,
		naming: raw.config.naming,
		targetPath: targetPath(raw, "seeds"),
	});

	print(message`${text(created)}`);
}
