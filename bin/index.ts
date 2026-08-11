#!/usr/bin/env node

import { getConfig } from "sqlumz";

const config = await getConfig();

console.log(config);
