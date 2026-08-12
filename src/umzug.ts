import { Sequelize } from "@sequelize/core";
import type { AbstractDialect, Options } from "@sequelize/core";
import { SequelizeStorage, Umzug } from "umzug";
import type {
	MigrateDownOptions,
	MigrateUpOptions,
	MigrationMeta,
	UmzugOptions as UmzugConstructorOptions,
} from "umzug";

import { resolveMigrations } from "#/migrations";
import type { UmzugContext } from "#/migrations";

export type UmzugOptions = {
	sequelizeOptions: Options<AbstractDialect> | undefined;
	migrationsPath: string;
	logger?: UmzugConstructorOptions["logger"];
};

export type RunOptions = MigrateUpOptions & UmzugOptions;

export type UndoOptions = MigrateDownOptions & UmzugOptions;

export async function createUmzug({
	sequelizeOptions,
	migrationsPath,
	logger,
}: UmzugOptions): Promise<{
	umzug: Umzug<UmzugContext>;
	sequelize: Sequelize;
}> {
	if (!sequelizeOptions) {
		throw new Error(
			`No database configured. Add a "sequelize" entry to your config.`,
		);
	}

	const sequelize = new Sequelize(sequelizeOptions);

	const umzug = new Umzug<UmzugContext>({
		migrations: await resolveMigrations(migrationsPath),
		context: { sequelize },
		storage: new SequelizeStorage({ sequelize }),
		logger,
	});

	return { umzug, sequelize };
}

async function withUmzug<T>(
	options: UmzugOptions,
	fn: (umzug: Umzug<UmzugContext>) => Promise<T>,
): Promise<T> {
	const { umzug, sequelize } = await createUmzug(options);

	try {
		return await fn(umzug);
	} finally {
		await sequelize.close();
	}
}

export async function run({
	sequelizeOptions,
	migrationsPath,
	logger,
	...migrate
}: RunOptions): Promise<MigrationMeta[]> {
	return withUmzug(
		{ sequelizeOptions, migrationsPath, logger },
		async (umzug) => umzug.up(migrate),
	);
}

export async function undo({
	sequelizeOptions,
	migrationsPath,
	logger,
	...migrate
}: UndoOptions): Promise<MigrationMeta[]> {
	return withUmzug(
		{ sequelizeOptions, migrationsPath, logger },
		async (umzug) => umzug.down(migrate),
	);
}

export async function status(
	options: UmzugOptions,
): Promise<{ executed: MigrationMeta[]; pending: MigrationMeta[] }> {
	return withUmzug(options, async (umzug) => {
		// sequential: concurrent model.sync() races on CREATE UNIQUE INDEX
		const executed = await umzug.executed();
		const pending = await umzug.pending();

		return { executed, pending };
	});
}
