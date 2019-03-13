import keytar from "keytar";

const FASS_SERVICE_NAME = "Beanni";

export class SecretStore {
    public interactivePrompt?: (promptText: string) => Promise<string>;

    public async storeSecret(key: string, secret: string) {
        await keytar.setPassword(this.formatServiceName(key), key, secret);
    }

    public async retrieveSecret(key: string): Promise<string> {
        let result = await keytar.findPassword(this.formatServiceName(key));
        if (result != null) {
            return result;
        }

        if (this.interactivePrompt != null) {
            result = await this.interactivePrompt(key);
            this.storeSecret(key, result);
            return result;
        }

        throw new Error("Couldn't find or prompt for secret " + key);
    }

    private formatServiceName(key: string): string {
        return FASS_SERVICE_NAME + ":" + key;
    }
}
