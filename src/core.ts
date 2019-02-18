import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from './types';
import fs = require('fs');
import yaml = require('yaml');
import { SecretStore } from './secretStore';

interface FassConfig
{
    relationships: Array<FassInstitutionRelationship>;
}

export interface FassExecutionContext
{
    debug: boolean;
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

        for (const relationship of config.relationships) {
            var secretPattern = /^\$secret (.*?)$/;

            var match = secretPattern.exec(relationship.username);
            if (match == null) continue;
            var secretKey = match[1];
            relationship.username = await this.secretStore.retrieveSecret(secretKey);;

            var match = secretPattern.exec(relationship.password);
            if (match == null) continue;
            var secretKey = match[1];
            relationship.password = await this.secretStore.retrieveSecret(secretKey);;
        };

        return config;
    }

    async validateConfig() {
        let config = await this.loadConfig();
        // TODO: Don't dump out secrets here
        console.log(JSON.stringify(config));
    }

    async fetch(executionContext:FassExecutionContext) {
        const config = await this.loadConfig();
        console.log('%s relationships to fetch from', config.relationships.length)

        const balances = new Array<AccountBalance>();

        for (const relationship of config.relationships) {
            console.log('Fetching \'%s\' via \'%s\'', relationship.name, relationship.provider);
            const providerName = relationship.provider;
            var module = require('./providers/' + providerName);
            var provider = <BankDataProviderInterface>new module[providerName]();

            var relationshipBalances = await provider.getBalances(relationship, executionContext);
            console.log('Found %s accounts', relationshipBalances.length);
            relationshipBalances.forEach(b => balances.push(b));
        }

        console.log(balances);
    }
}
