#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import { SecretStore } from './secretStore';
import { Core, FassExecutionContext } from './core';
import program from 'commander';

const secretStore = new SecretStore();
const core = new Core(secretStore);

program
    .name('fass')
    .option('-d, --debug');

program
    .command('validate-config')
    .action(async function() {
        await core.validateConfig();
    });

program
    .command('store-secret <key> <secret>')
    .action(async function(key, secret) {
        await secretStore.storeSecret(key, secret);
    });

program
    .command('fetch')
    .action(async function() {
        const executionContext = parseExecutionContext();
        await core.fetch(executionContext);
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
