#!/usr/bin/env node
import { DataStore } from './dataStore';
import { SecretStore } from './secretStore';
import { Core, FassExecutionContext } from './core';
import { Explorer } from './web/explorer';
import program from 'commander';
import inquirer from 'inquirer';

const dataStore = new DataStore();

const secretStore = new SecretStore();
secretStore.interactivePrompt = async (promptText : string) => {
    console.log('Missing a secret');
    console.warn('What you enter here will be persisted to secure store');
    var pr:{secret:string} = await inquirer.prompt([
        {
            type: 'password',
            name: 'secret',
            message: promptText + ':',
            validate: (val:string) : boolean => {
                return val.length > 0;
            }
        }
    ]);
    return pr.secret;
};

const core = new Core(dataStore, secretStore);

program
    .name('beanni')
    .option('-d, --debug');

program
    .command('explore')
    .action(async function() {
        const executionContext = parseExecutionContext();
        const explorer = new Explorer(dataStore);
        explorer.run((url) => {
            console.log(`Listening on ${url}`);
            console.log('Press Ctrl+C to quit');
            var start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
            require('child_process').exec(start + ' ' + url);
        });
    });

program
    .command('fetch')
    .action(async function() {
        const executionContext = parseExecutionContext();
        await core.fetch(executionContext);
    });

program
    .command('init')
    .action(async function() {
        const executionContext = parseExecutionContext();
        await core.init(executionContext);
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
