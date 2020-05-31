#!/usr/bin/env node
import program from "commander";
import inquirer from "inquirer";
import { Core, IBeanniExecutionContext } from "./core";
import { DataStore } from "./dataStore";
import { DynamicSecretStore } from "./dynamicSecretStore";
import { Explorer } from "./web/explorer";

const dataStore = new DataStore();

const secretStore = new DynamicSecretStore();
const core = new Core(dataStore, secretStore);

program
    .name("beanni")
    .option("-d, --debug");

program
    .command("explore")
    .action(async () => {
        const executionContext = parseExecutionContext();
        const explorer = new Explorer();
        explorer.run((url) => {
            console.log(`Listening on ${url}`);
            console.log("Press Ctrl+C to quit");
            const start = (
                process.platform === "darwin" ? "open" :
                process.platform === "win32" ? "start" :
                "xdg-open"
            );
            require("child_process").exec(start + " " + url);
        });
    });

program
    .command("fetch")
    .action(async () => {
        const executionContext = parseExecutionContext();
        await core.fetch(executionContext);
    });

program
    .command("init")
    .action(async () => {
        const executionContext = parseExecutionContext();
        await core.init(executionContext);
    });

program
    .command("store-secret <key> [secret]")
    .action(async (key: string, secret?: string) => {
        if (secret == null) {
            const pr: {secret: string} = await inquirer.prompt([
                {
                    type: "password",
                    name: "secret",
                    message: "Secret:",
                    validate: (val: string): boolean => {
                        return val.length > 0;
                    },
                },
            ]);
            secret = pr.secret;
        }
        await secretStore.storeSecret(key, secret);
    });

program
    .command("validate-config")
    .action(async () => {
        await core.validateConfig();
    });

program.on("command:*", () => {
    console.error("Invalid command: %s\nSee --help for a list of available commands.", program.args.join(" "));
    process.exit(1);
});

program.parse(process.argv);

function parseExecutionContext(): IBeanniExecutionContext {
    return {
        debug: (program.opts().debug === true),
    };
}
