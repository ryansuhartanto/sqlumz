import { defineConfig } from "sqlumz";

const config = defineConfig({
	sequelize: {
		dialect: "postgres",
	},
});

export default config;
