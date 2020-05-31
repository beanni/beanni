import fs = require("fs");
import os = require("os");
import inquirer from "inquirer";
import { ISecretStore } from "./types";
import { HeadlessSecretStore } from "./headlessSecretStore";
import { KeytarSecretStore } from "./keytarSecretStore";

export class DynamicSecretStore implements ISecretStore {
    underlyingStore : ISecretStore;

    headlessSecretPath = this.expandHeadlessSecretPath();
    headless = false;

    constructor() {
        var headless = this.headless = fs.existsSync(this.headlessSecretPath);
        if (headless) {
            console.warn("🚨 Found a secret file at " + this.headlessSecretPath + "; using that for all secrets. Only use this approach in totally headless scenarios.");
            this.underlyingStore = new HeadlessSecretStore(this.headlessSecretPath);
        }
        else
        {
            this.underlyingStore = this.setupKeytarSecretProvider();
        }
    }

    private expandHeadlessSecretPath() : string {
        return os.homedir() + '/.beanni/secrets.yaml';
    }

    private writeHeadlessSystemHint() {
        if (this.headless) { return; }
        console.info("On headless systems, create an empty file at `" + this.headlessSecretPath + "`, then re-run this command");
    }

    private setupKeytarSecretProvider() {
        const keytarSecretStore = new KeytarSecretStore();
        keytarSecretStore.interactivePrompt = async (promptText: string) => {
            console.log("Missing a secret");
            console.warn("What you enter here will be persisted to secure store");
            const pr: { secret: string; } = await inquirer.prompt([
                {
                    type: "password",
                    name: "secret",
                    message: promptText + ":",
                    validate: (val: string): boolean => {
                        return val.length > 0;
                    },
                },
            ]);
            return pr.secret;
        };
        return keytarSecretStore;
    }

    public async storeSecret(key: string, secret: string) {
        try
        {
            await this.underlyingStore.storeSecret(key, secret);
        }
        catch (err)
        {
            this.writeHeadlessSystemHint();
            throw err;
        }
    }

    public async retrieveSecret(key: string): Promise<string> {
        try
        {
            return await this.underlyingStore.retrieveSecret(key);
        }
        catch (err)
        {
            this.writeHeadlessSystemHint();
            throw err;
        }
    }
}
