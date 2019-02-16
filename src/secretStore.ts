import keytar from 'keytar';

const FASS_SERVICE_NAME = 'Finance Assistant';

export class SecretStore
{
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
        if (result == null) throw 'Couldn\'t find secret ' + key;
        return result;
    }
}
