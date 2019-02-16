import { BankDataProviderInterface } from './types';
import fs = require('fs');
import yaml = require('yaml');

interface FassConfig
{
    accounts: Array<FassConfigAccount>;
}

interface FassConfigAccount
{
    name: string;
    provider: string;
}

export class Core
{
    loadConfig() : FassConfig {
        const configFileText = fs.readFileSync('./config.yaml', 'utf8');
        let config = <FassConfig>yaml.parse(configFileText);
        return config;
    }

    validateConfig() {
        let config = this.loadConfig();
        console.log(JSON.stringify(config));
    }

    async fetch() {
        let config = this.loadConfig();
        console.log('%s accounts to fetch from', config.accounts.length)

        config.accounts.forEach(async account => {
            console.log('Fetching %s via %s', account.name, account.provider);
            const providerName = account.provider;
            var module = require('./providers/' + providerName);
            var provider = <BankDataProviderInterface>new module[providerName]();
            var balance = await provider.getBalance();
            console.log(balance);
        });
    }
}
