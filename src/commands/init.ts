import { command, constant, message, object } from "@optique/core";

export const initCommand = command(
	"init",
	object({ action: constant("init") }),
	{ description: message`Initialize configuration` },
);
