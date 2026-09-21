import { getLogger } from "@logtape/logtape";
import {
	DataTypes,
	Sequelize,
	type AbstractDialect,
	type Options,
} from "@sequelize/core";
import {
	SequelizeStorage,
	Umzug,
	type MigrateDownOptions,
	type MigrateUpOptions,
	type MigrationMeta,
	type UmzugOptions as UmzugConstructorOptions,
} from "umzug";

import { resolveMigrations, type UmzugContext } from "#/migrations";

export interface UmzugOptions {
	sequelizeOptions: Options<AbstractDialect> | undefined;
	/** Directory of migrations or seeds to resolve. */
	folder: string;
	/** Storage table recording what ran. Defaults to umzug's `SequelizeMeta`. */
	modelName?: string;
	logger?: UmzugConstructorOptions["logger"];
}

export type RunOptions = MigrateUpOptions & UmzugOptions;

export type UndoOptions = MigrateDownOptions & UmzugOptions;

// umzug's LogFn takes a bare property bag, which is one of LogTape's overloads
export async function createUmzug({
	sequelizeOptions,
	folder,
	modelName = "SequelizeMeta",
	logger = getLogger(["sqlumz", "migration"]),
}: UmzugOptions): Promise<{
	umzug: Umzug<UmzugContext>;
	sequelize: Sequelize;
}> {
	if (!sequelizeOptions) {
		throw new Error(
			`No database configured. Add a "sequelize" entry to your config.`,
		);
	}

	const sql = getLogger(["sqlumz", "sequelize"]);

	// spread last so a caller-supplied `logging` wins
	const sequelize = new Sequelize({
		benchmark: true,
		logging: (statement, timing) =>
			sql.debug("{statement}", { statement, duration: `${timing}ms` }),
		...sequelizeOptions,
	});

	const umzug = new Umzug<UmzugContext>({
		migrations: await resolveMigrations(folder),
		context: { sequelize },
		// umzug builds its own model via the deprecated sequelize.isDefined() (SEQUELIZE0029)
		storage: new SequelizeStorage({
			model: sequelize.define(
				modelName,
				{
					name: {
						type: DataTypes.STRING,
						allowNull: false,
						unique: true,
						primaryKey: true,
					},
				},
				{ timestamps: false },
			),
		}),
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
	folder,
	modelName,
	logger,
	...migrate
}: RunOptions): Promise<MigrationMeta[]> {
	return withUmzug(
		{ sequelizeOptions, folder, modelName, logger },
		async (umzug) => umzug.up(migrate),
	);
}

export async function undo({
	sequelizeOptions,
	folder,
	modelName,
	logger,
	...migrate
}: UndoOptions): Promise<MigrationMeta[]> {
	return withUmzug(
		{ sequelizeOptions, folder, modelName, logger },
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
