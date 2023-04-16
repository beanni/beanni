import fs = require("fs");
import yaml = require("js-yaml");
import { Dictionary } from "lodash";
import { ISecretStore } from "./types";

export class HeadlessSecretStore implements ISecretStore {
  private data: Dictionary<string> = {};

  constructor(path: string) {
    const configFileText = fs.readFileSync(path, "utf8");
    const fileData = yaml.load(configFileText) as {
      secrets: { key: string; value: string }[];
    };

    if (fileData?.secrets == null) {
      console.log(
        'The secrets file is empty. Example format to use:\n\n```\nsecrets:\n\t- key: Westpac:username\n\tvalue: "12345678"\n\t- key: Westpac:password\n\tvalue: "abcdef"\n```\n'
      );
      return;
    }

    fileData.secrets.forEach((s: { key: string; value: string }) => {
      this.data[s.key] = s.value;
    });
  }

  public async storeSecret(key: string): Promise<void> {
    console.info(
      "Asked to persist secret " +
        key +
        "; ignoring because we're in headless mode"
    );
  }

  public async retrieveSecret(key: string): Promise<string> {
    const secret = this.data[key];
    if (secret === undefined) {
      console.warn(
        "Tried to read secret " +
          key +
          " but couldn't find it in the headless secrets file"
      );
    }
    return secret;
  }
}
