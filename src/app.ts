#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import { DataStore } from './dataStore';
import { SecretStore } from './secretStore';
import { Core, FassExecutionContext } from './core';
import program from 'commander';
import inquirer from 'inquirer';

const dataStore = new DataStore();
const secretStore = new SecretStore();
const core = new Core(dataStore, secretStore);

program
    .name('beanni')
    .option('-d, --debug');

program
    .command('fetch')
    .action(async function() {
        const executionContext = parseExecutionContext();
        await core.fetch(executionContext);
    });

program
    .command('store-secret <key> [secret]')
    .action(async function(key:string, secret?:string) {
        if (secret == null)
        {
            var pr:{secret:string} = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'secret',
                    message: 'Secret:',
                    validate: (val:string) : boolean => {
                        return val.length > 0;
                    }
                }
            ]);
            secret = pr.secret;
        }
        await secretStore.storeSecret(key, secret);
    });

program
    .command('validate-config')
    .action(async function() {
        await core.validateConfig();
    });

program.on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
});

program.parse(process.argv);

function parseExecutionContext() : FassExecutionContext
{
    return {
        debug: (program.opts().debug === true)
    };
}
