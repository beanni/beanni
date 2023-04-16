import keytar from "keytar";
import { ISecretStore } from "./types";

const FASS_SERVICE_NAME = "Beanni";

export class KeytarSecretStore implements ISecretStore {
  public interactivePrompt?: (promptText: string) => Promise<string>;

  public async storeSecret(key: string, secret: string): Promise<void> {
    try {
      await keytar.setPassword(this.formatServiceName(key), key, secret);
    } catch (reason) {
      console.error(
        "Failed to persist secret " + key + " for future re-use; will work once"
      );
      console.error(reason);
    }
  }

  public async retrieveSecret(key: string): Promise<string> {
    let result;
    try {
      result = await keytar.findPassword(this.formatServiceName(key));
    } catch (ex) {
      console.error(ex);
      throw new Error("Couldn't lookup secret " + key);
    }

    if (result != null) {
      return result;
    }

    if (this.interactivePrompt != null) {
      result = await this.interactivePrompt(key);
      await this.storeSecret(key, result);
      return result;
    }

    throw new Error("Couldn't find or prompt for secret " + key);
  }

  private formatServiceName(key: string): string {
    return FASS_SERVICE_NAME + ":" + key;
  }
}
