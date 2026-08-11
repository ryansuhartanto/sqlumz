import { AbstractDialect } from "@sequelize/core";
import type { DialectName, Options } from "@sequelize/core";
import { cosmiconfig } from "cosmiconfig";
import type { Class } from "type-fest";
import z from "zod";

export type { Class };

type ExhaustiveTuple<T, U extends T[]> = [T] extends [U[number]]
	? [U[number]] extends [T]
		? U
		: never
	: never;

const createDialectNames = <T extends DialectName[]>(
	...args: ExhaustiveTuple<DialectName, T>
) => args;

const dialectNameSchema = z.enum(
	createDialectNames(
		"mysql",
		"postgres",
		"sqlite3",
		"mariadb",
		"mssql",
		"db2",
		"snowflake",
		"ibmi",
		"oracle",
	),
);

const dialectClassSchema = z.custom<Class<AbstractDialect>>(
	(val) =>
		typeof val === "function" && val.prototype instanceof AbstractDialect,
);

const sequelizeSchema = z.object({
	dialect: z.union([dialectNameSchema, dialectClassSchema]),
}) satisfies z.ZodType<Options<AbstractDialect>>;

export const configSchema = z.strictObject({
	path: z
		.object({
			migrations: z.string().default("migrations"),
			seeds: z.string().default("seeds"),
		})
		.prefault({}),
	sequelize: sequelizeSchema satisfies z.ZodType<Options<AbstractDialect>>,
});

export function defineConfig(config: Config): Config {
	return configSchema.parse(config);
}

export type Config = z.input<typeof configSchema>;

const moduleName = "sqlumz";
const explorer = cosmiconfig(moduleName);

export async function getConfig(
	search?: string,
): Promise<z.output<typeof configSchema>> {
	const result = await explorer.search(search);
	return configSchema.parse(result?.config);
}
