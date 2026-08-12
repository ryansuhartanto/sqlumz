import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { command, constant, message, object, text } from "@optique/core";
import { print } from "@optique/run";

import { loadConfig } from "#/config";
import { isEsmProject } from "#/utils";

export const initCommand = command(
	"init",
	object({ action: constant("init") }),
	{ description: message`Initialize configuration` },
);

const CONFIG_FILE = "sqlumz.config.ts";

// `import`/`export default` is invalid syntax under an explicit
// `"type": "commonjs"` package.json, where Node's ESM-syntax auto-detection
// doesn't apply; `require`/`module.exports` is the one syntax that loads
// under both an unset and an explicit "commonjs" module type.
function buildConfigTemplate(esm: boolean): string {
	const importLine = esm
		? `import { defineConfig } from "sqlumz";`
		: `const { defineConfig } = require("sqlumz");`;
	const exportStart = esm
		? "export default defineConfig({"
		: "module.exports = defineConfig({";

	return `${importLine}

${exportStart}
	sequelize: {
		// See the README for the full list of supported dialects.
		dialect: "sqlite3",
	},
});
`;
}

export async function executeInit(): Promise<void> {
	const existing = await loadConfig({});

	if (existing) {
		print(message`Config already exists at ${text(existing.meta.configPath)}`);

		return;
	}

	const esm = await isEsmProject(process.cwd());
	const file = join(process.cwd(), CONFIG_FILE);

	await writeFile(file, buildConfigTemplate(esm));
	print(message`${text(file)}`);
}
