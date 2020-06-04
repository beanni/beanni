import fs = require("fs");
import yaml = require("js-yaml");
import { Dictionary } from "lodash";
import { ISecretStore } from "./types";

export class HeadlessSecretStore implements ISecretStore {
    private data: Dictionary<string> = {};

    constructor(path: string) {
        const configFileText = fs.readFileSync(path, "utf8");
        const fileData =  yaml.safeLoad(configFileText);

        if (fileData === undefined) {
            console.log("The secrets file is empty. Example format to use:\n\n```\nsecrets:\n\t- key: Westpac:username\n\tvalue: \"12345678\"\n\t- key: Westpac:password\n\tvalue: \"abcdef\"\n```\n");
            return;
        }

        fileData.secrets.forEach((s: any) => {
            this.data[s.key] = s.value;
        });
    }

    public async storeSecret(key: string, secret: string) {
        console.info("Asked to persist secret " + key + "; ignoring because we're in headless mode");
    }

    public async retrieveSecret(key: string): Promise<string> {
        return this.data[key];
    }
}
