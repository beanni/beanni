import { BankDataProviderInterface, FassAccount } from './types';
import fs = require('fs');
import yaml = require('yaml');
import { SecretStore } from './secretStore';

interface FassConfig
{
    accounts: Array<FassAccount>;
}

// export const YamlSecretTag : yaml.Tag = {
//     identify: (value:any) => false,
//     default: true,
//     tag: 'tag:yaml.org,2002:secret',
//     test: /^\!secret (.*?)$/,
//     resolve: (str:string, key:string) : yaml.ast.Node => {
      
//         //return 'top secret value for: ' + key;
//     },
//     stringify: (value:any) => value
// }
// yaml.defaultOptions.tags = [YamlSecretTag];

export class Core
{
    secretStore: SecretStore;

    constructor(secretStore: SecretStore) {
        this.secretStore = secretStore;
    }


    async loadConfig() : Promise<FassConfig> {
        const configFileText = fs.readFileSync('./config.yaml', 'utf8');
        let config = <FassConfig>yaml.parse(configFileText);

        for (const account of config.accounts) {
            var secretPattern = /^\$secret (.*?)$/;
            var match = secretPattern.exec(account.password);
            if (match == null) continue;
            var secretKey = match[1];
            account.password = await this.secretStore.retrieveSecret(secretKey);;
        };

        return config;
    }

    async validateConfig() {
        let config = await this.loadConfig();
        // TODO: Don't dump out secrets here
        console.log(JSON.stringify(config));
    }

    async fetch() {
        let config = await this.loadConfig();
        console.log('%s accounts to fetch from', config.accounts.length)

        config.accounts.forEach(async account => {
            console.log('Fetching %s via %s', account.name, account.provider);
            const providerName = account.provider;
            var module = require('./providers/' + providerName);
            var provider = <BankDataProviderInterface>new module[providerName]();
            var balance = await provider.getBalance(account);
            console.log(balance);
        });
    }
}
