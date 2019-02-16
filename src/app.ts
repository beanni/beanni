#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import { SecretStore } from './secretStore';
import { Core } from './core';
import program from 'commander';

const secretStore = new SecretStore();
const core = new Core(secretStore);

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
        await core.fetch();
    });

program.on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
});

program.parse(process.argv);
