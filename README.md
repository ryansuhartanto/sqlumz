# sqlumz

[![npm](https://img.shields.io/npm/v/sqlumz?logo=npm)](https://www.npmjs.com/package/sqlumz)
[![ci](https://github.com/ryansuhartanto/sqlumz/actions/workflows/ci.yaml/badge.svg)](https://github.com/ryansuhartanto/sqlumz/actions/workflows/ci.yaml)
[![node](https://img.shields.io/node/v/sqlumz?logo=nodedotjs)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/sqlumz)](LICENSE)

Migrations and seeds for [Sequelize v7](https://sequelize.org),
powered by
[umzug](https://github.com/sequelize/umzug).

Write migrations and seeds as plain SQL or as TypeScript/JavaScript modules.

> [!NOTE]
> This is a temporary solution before @sequelize/cli stabilizes.

## Install

```sh
npm install --save-dev sqlumz
```

Install the dialect package for your database alongside it:

- `@sequelize/postgres`
- `@sequelize/mysql`
- `@sequelize/sqlite3`
- and so on.

## Configure

Initialize with:

```sh
sqlumz init
```

Writes a starter `sqlumz.config.ts` in the current directory and refuses, printing the existing
path instead, if a config is already found.

sqlumz reads its config through [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig), pick either:

- `sqlumz.config.js`
- `.sqlumzrc.json`
- `.config/sqlumzrc.ts`
- `sqlumz` key in `package.json`

all would work.

```ts
import { defineConfig } from "sqlumz";

export default defineConfig({
  sequelize: {
    dialect: "postgres",
  },
});
```

| Key               | Default        | Meaning                                                                    |
| ----------------- | -------------- | -------------------------------------------------------------------------- |
| `sequelize`       | —              | Options passed to `new Sequelize()`. Omit it and only scaffolding works.   |
| `format`          | `"ts"`         | Scaffold format: `sql`, `js`, `ts`, `mjs`, `cjs`, `mts`, or `cts`.         |
| `naming`          | `"timestamp"`  | Filename prefix: `timestamp` or `sequence`.                                |
| `emptyName`       | `"warn"`       | What to do when `--name` slugifies to empty: `warn`, `silent`, or `error`. |
| `path.migrations` | `"migrations"` | Migrations directory.                                                      |
| `path.seeds`      | `"seeds"`      | Seeds directory.                                                           |

Relative paths resolve against the project root.

`dialect` takes either a supported dialect name or an imported dialect class:

```ts
import { PostgresDialect } from "@sequelize/postgres";

export default defineConfig({
  sequelize: { dialect: PostgresDialect },
});
```

## Commands

```sh
sqlumz migration generate --name "create users"   # scaffold
sqlumz migration run                              # apply everything pending
sqlumz migration status                           # list executed and pending
sqlumz migration undo                             # revert the last one
```

`seed` takes the same four subcommands, against `path.seeds`.

| Flag                  | Applies to    | Meaning                                                                             |
| --------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `--to <name>`         | `run`, `undo` | Stop at this migration, inclusive. `--to 0` on `undo` reverts everything.           |
| `--step <n>`          | `run`, `undo` | Only apply or revert this many.                                                     |
| `--name <name>`       | `generate`    | Required. Slugified into the filename.                                              |
| `--format <fmt>`      | `generate`    | Override the configured `format`: `sql`, `js`, `ts`, `mjs`, `cjs`, `mts`, or `cts`. |
| `-c, --config <path>` | all           | Use a specific config file instead of searching.                                    |
| `-v, --verbose`       | all           | Repeatable. `-v` for info, `-vv` for debug SQL.                                     |

`--to` and `--step` are mutually exclusive; passing both is a usage error.

## Writing migrations

### SQL

`--format sql` creates a directory holding `up.sql` and `down.sql`:

```
migrations/260812093045-create-users/
├── up.sql
└── down.sql
```

Statements are split on `;` and run inside one transaction, so a failure part-way rolls back the
whole file. A migration with only an `up.sql` cannot be reverted, and `undo` will say so.

> [!IMPORTANT]
> The splitter is deliberately naive. It does not understand semicolons inside string literals,
> `BEGIN … END` bodies, or dollar-quoting. Use a `.ts`/`.js` migration for those.

A single `.sql` file (no directory) also works, and is treated as up-only.

### TypeScript and JavaScript

```ts
import type { UmzugContext } from "sqlumz";

export async function up({ sequelize }: UmzugContext): Promise<void> {
  await sequelize.query(`CREATE TABLE users (id SERIAL PRIMARY KEY)`);
}

export async function down({ sequelize }: UmzugContext): Promise<void> {
  await sequelize.query(`DROP TABLE users`);
}
```

`.js`, `.ts`, `.mjs`, `.cjs`, `.mts`, and `.cts` are all recognised, as named exports or as a
default export object. Your runtime has to be able to import the file — for `.ts`, that means
Node's type stripping or a loader.

`generate --format js`/`ts` scaffolds follow the nearest `package.json`'s `"type"` field — ESM
when it's `"module"`, CommonJS otherwise. Request `.mjs`/`.mts` or `.cjs`/`.cts` to force one
explicitly regardless of `package.json`.

Migrations run in filename order, compared with `localeCompare`. If you pick `naming: "sequence"`,
never change the zero-pad width once migrations exist; it silently reorders history.

## Logging

Output goes through [LogTape](https://logtape.org). `-v` raises the level, `-vv` shows every
statement Sequelize executes with its timing. `--log-output <file>` redirects it.

## Programmatic use

Every command is also a function, so you can run migrations from a script or a test harness:

```ts
import { run, status, undo } from "sqlumz";

const options = {
  sequelizeOptions: { dialect: "postgres" },
  folder: "./migrations",
};

await run(options); // all pending
await run({ ...options, step: 1 }); // one
await undo({ ...options, to: 0 }); // revert everything

const { executed, pending } = await status(options);
```

Pass `modelName` to track state in a different table — that's how seeds stay separate from
migrations:

```ts
await run({ ...options, folder: "./seeds", modelName: "SequelizeData" });
```

`run` and `undo` accept umzug's own `MigrateUpOptions` / `MigrateDownOptions`, so `migrations` and
`rerun` work too.

## License

[MIT](LICENSE)
