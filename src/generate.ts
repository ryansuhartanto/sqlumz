import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import z from "zod";

import {
	getCurrentTimestamp,
	isEsmProject,
	nextSequence,
	slugify,
} from "#/utils";

export const formatSchema = z.enum([
	"sql",
	"js",
	"ts",
	"mjs",
	"cjs",
	"mts",
	"cts",
]);

export const namingSchema = z.enum(["timestamp", "sequence"]);

export type MigrationFormat = z.infer<typeof formatSchema>;

export type MigrationNaming = z.infer<typeof namingSchema>;

export type GenerateOptions = {
	format: MigrationFormat;
	name: string;
	/**
	 * `sequence` never changes its zero-pad width once migrations exist —
	 * widening it silently reorders history.
	 */
	naming?: MigrationNaming;
	targetPath: string;
};

const SQL_HEADER = `-- Split on ";" and run in one transaction.
-- Needs triggers, procedures, or semicolons inside strings? Use a .ts/.js migration.
`;

const CONTEXT_TYPE_IMPORT = `import type { UmzugContext } from "sqlumz";\n\n`;

const FUNCTION_TYPE_DOC = `/** @type {import("sqlumz").MigrationFunction} */\n`;

type Language = "js" | "ts";
type ModuleSystem = "esm" | "cjs";

function moduleFunction(
	name: "up" | "down",
	language: Language,
	moduleSystem: ModuleSystem,
): string {
	const param =
		language === "ts" ? "{ sequelize }: UmzugContext" : "{ sequelize }";
	const returnType = language === "ts" ? ": Promise<void>" : "";
	const doc = language === "js" ? FUNCTION_TYPE_DOC : "";

	return moduleSystem === "esm"
		? `${doc}export async function ${name}(${param})${returnType} {\n}\n`
		: `${doc}exports.${name} = async function ${name}(${param})${returnType} {\n};\n`;
}

function buildSkeleton(language: Language, moduleSystem: ModuleSystem): string {
	const header = language === "ts" ? CONTEXT_TYPE_IMPORT : "";

	return `${header}${moduleFunction("up", language, moduleSystem)}\n${moduleFunction("down", language, moduleSystem)}`;
}

const FORMAT_SYNTAX: Record<
	Exclude<MigrationFormat, "sql">,
	{ language: Language; moduleSystem: ModuleSystem | "auto" }
> = {
	js: { language: "js", moduleSystem: "auto" },
	ts: { language: "ts", moduleSystem: "auto" },
	mjs: { language: "js", moduleSystem: "esm" },
	mts: { language: "ts", moduleSystem: "esm" },
	cjs: { language: "js", moduleSystem: "cjs" },
	// cts: type stripping erases `import type` but doesn't rewrite `export`,
	// which is invalid in a .cts file — CJS output is required despite the
	// TS-flavored annotation.
	cts: { language: "ts", moduleSystem: "cjs" },
};

export async function generate({
	format,
	name,
	naming = "timestamp",
	targetPath,
}: GenerateOptions): Promise<string> {
	await mkdir(targetPath, { recursive: true });

	const prefix =
		naming === "sequence"
			? nextSequence(await readdir(targetPath))
			: getCurrentTimestamp();

	const base = `${prefix}-${slugify(name)}`;

	if (format === "sql") {
		const folder = join(targetPath, base);

		await mkdir(folder);
		await Promise.all([
			writeFile(join(folder, "up.sql"), SQL_HEADER),
			writeFile(join(folder, "down.sql"), SQL_HEADER),
		]);

		return folder;
	}

	const file = join(targetPath, `${base}.${format}`);
	const { language, moduleSystem } = FORMAT_SYNTAX[format];
	let resolvedModuleSystem: ModuleSystem;

	if (moduleSystem === "auto") {
		resolvedModuleSystem = (await isEsmProject(targetPath)) ? "esm" : "cjs";
	} else {
		resolvedModuleSystem = moduleSystem;
	}

	await writeFile(file, buildSkeleton(language, resolvedModuleSystem));

	return file;
}
