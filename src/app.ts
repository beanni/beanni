#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import program from 'commander';
import tsnode = require('ts-node');
import fs = require('fs');
import yaml = require('yaml');

program
    .command('validate-config')
    .action(function() {
        console.log(process.cwd());
        const configFileText = fs.readFileSync('./config.yaml', 'utf8');
        let config = yaml.parse(configFileText);
        console.log(JSON.stringify(config));
    });

program
    .command('fetch <providerName>')
    .action(async function(providerName) {
        console.log("Running provider %s", providerName);
        var module = require('./providers/' + providerName);
        var provider = <BankDataProviderInterface>new module[providerName]();
        var balance = await provider.getBalance();
        console.log(balance);
    });

program.on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
});

program.parse(process.argv);
