#!/usr/bin/env node
import program = require('commander');

program
    .arguments('<institution>')
    .option('-u, --username <username>', 'The user to authenticate as')
    .option('-p, --password <password>', 'The user\'s password')
    .action(function(institution) {
        console.log('Institution: %s; User: %s; Passowrd: %s.', 
            institution, program.username, program.password);
    })
    .parse(process.argv);