import { Sequelize } from "@sequelize/core";
import type { AbstractDialect, Options } from "@sequelize/core";
import { SequelizeStorage, Umzug } from "umzug";
import type {
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

export type StepOptions = {
	to?: string;
	step?: number;
} & UmzugOptions;

export type UndoOptions = {
	/** `0` reverts every executed migration. */
	to?: string | 0;
	step?: number;
} & UmzugOptions;

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
	to,
	step,
	...options
}: StepOptions): Promise<MigrationMeta[]> {
	if (to !== undefined && step !== undefined) {
		throw new Error(`Pass either "to" or "step", not both.`);
	}

	return withUmzug(options, async (umzug) => {
		if (to !== undefined) {
			return umzug.up({ to });
		}

		if (step !== undefined) {
			return umzug.up({ step });
		}

		return umzug.up();
	});
}

export async function undo({
	to,
	step,
	...options
}: UndoOptions): Promise<MigrationMeta[]> {
	if (to !== undefined && step !== undefined) {
		throw new Error(`Pass either "to" or "step", not both.`);
	}

	return withUmzug(options, async (umzug) => {
		if (to !== undefined) {
			return umzug.down({ to });
		}

		if (step !== undefined) {
			return umzug.down({ step });
		}

		return umzug.down();
	});
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
