import keytar from 'keytar';

const FASS_SERVICE_NAME = 'Beanni';

export class SecretStore
{
    interactivePrompt? : (promptText : string) => Promise<string>;

    private formatServiceName(key: string): string {
        return FASS_SERVICE_NAME + ':' + key;
    }

    async storeSecret(key : string, secret : string)
    {
        await keytar.setPassword(this.formatServiceName(key), key, secret);
    }

    async retrieveSecret(key : string) : Promise<string>
    {
        let result = await keytar.findPassword(this.formatServiceName(key));
        if (result != null)
        {
            return result;
        }

        if (this.interactivePrompt != null)
        {
            result = await this.interactivePrompt(key);
            this.storeSecret(key, result);
            return result;
        }

        throw 'Couldn\'t find or prompt for secret ' + key;
    }
}
