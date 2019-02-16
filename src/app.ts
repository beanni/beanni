#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import { Core } from './core';
import program from 'commander';

const core = new Core();

program
    .command('validate-config')
    .action(function() {
        core.validateConfig();
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
