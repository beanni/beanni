#!/usr/bin/env node
import { BankDataProviderInterface } from './types';
import program from 'commander';
import tsnode = require('ts-node');

program
    .arguments('<institution>')
    .option('-u, --username <username>', 'The user to authenticate as')
    .option('-p, --password <password>', 'The user\'s password')
    .action(function(providerName) {
        console.log("Running provider %s", providerName);
        var module = require('./providers/' + providerName);
        var provider = <BankDataProviderInterface>new module[providerName]();
        var balance = provider.getBalance();
        console.log(balance);
    })
    .parse(process.argv);

console.log('No params? Try --help');
