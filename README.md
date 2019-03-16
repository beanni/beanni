# Beanni

Your friendly Australian bean-counter, [Beanni](https://www.youtube.com/watch?v=Aey_zIE3K9E).

[![npm](https://img.shields.io/npm/v/beanni.svg)](https://www.npmjs.com/package/beanni)
[![npm](https://img.shields.io/npm/dt/beanni.svg)](https://www.npmjs.com/package/beanni)
[![GitHub contributors](https://img.shields.io/github/contributors/beanni/beanni.svg)](https://github.com/beanni/beanni/graphs/contributors)
[![Azure DevOps builds](https://img.shields.io/azure-devops/build/beanni/efed68d6-5a84-4c28-909a-8af3549a7f70/1/master.svg)](https://dev.azure.com/beanni/Beanni/_build?definitionId=1)

By [@mjhilton](https://github.com/mjhilton) and [@tathamoddie](https://github.com/tathamoddie).

Beanni helps gather financial data from all of your various providers, institutions, and banks. Having all of this cached in a local database allows you to do deeper analysis than typical online banking tools would allow, such as spend-by-merchant stats, or net-worth trends.

Beanni is just a local helper, on your own machine. You're not sharing your passwords with us, or anybody else. You're not reverse engineering your bank. Beanni is just a robot that's really fast at clicking the same transaction export buttons that you would otherwise have to click manually.

## Usage

### First Run

Get started in minutes:

| Step | Run | Why |
| --- | --- | --- |
| 1. | https://nodejs.org/en/download/ | Beanni is built on Node.js |
| 2. | `node --version` | Make sure you're on Node ≥10.13.0 |
| 3. | `npm --version` | Make sure you're on NPM ≥6.8.0 |
| 4. | `mkdir beanni` <br/> `cd beanni` | Create a local folder where config and data will be stored |
| 5. | `npm install beanni` | Install Beanni into this folder |
| 6. | `npx beanni init` | Create an example `config.yaml` |
| 7. | Edit `config.yaml` | Add your own banking relationships |
| 8. | `npx beanni fetch` | Grab your data |
| 9. | `npx beanni explore` | Launch the analysis UI |

💡 Be careful with `npm` vs `npx` in some of those commands; they look very similar at a glance.

### Ongoing Usage

In future:

| Step | Run | Why |
| --- | --- | --- |
| 1. | `npm update beanni` | Update Beanni to the latest version |
| 2. | `npx beanni fetch` | Grab your data |
| 3. | `npx beanni explore` | Launch the analysis UI |

### Uninstall

1. Delete the local working folder (the database contains bank account numbers and financial data)
1. Remove secrets from your operating system's credential store
    * Windows:
        1. `Win` > `credential manager`
        1. _Windows Credentials_
        1. _Generic Credentials_
        1. Look for anything that starts with `Beanni:`
    * MacOS: Keychain

## Security, by design

### Execution Environment

Beanni all runs locally on your own machine, or your own hosting. There are no shared web services in play.

### Secret Storage

Secrets are kept out of configuration files entirely, by design.

Secrets are stored in your operating system's credential store (Credential Manager on Windows, or Keychain on MacOS). We use [keytar](https://www.npmjs.com/package/keytar) to do this, which is [built and maintained by the Atom project](https://github.com/atom/node-keytar).

### Dependency Supply Chain

Our dependency supply chain is the biggest risk. We've been careful to keep our [package.json](package.json) dependencies list short, and highly trustworthy:

| Package | Weekly Package Downloads | Known/Trusted Maintainer |
| --- | --- | --- |
| [`commander`](https://www.npmjs.com/package/commander) | >15M | |
| [`express`](https://www.npmjs.com/package/express) | >5M | |
| [`inquirer`](https://www.npmjs.com/package/inquirer) | ~10M | |
| [`js-yaml`](https://www.npmjs.com/package/js-yaml) | >10M | |
| [`keytar`](https://www.npmjs.com/package/keytar) | >20k | [Atom](https://github.com/atom/node-keytar) |
| [`lodash`](https://www.npmjs.com/package/lodash) | >15M | |
| [`pug`](https://www.npmjs.com/package/pug) | >300k | |
| [`puppeteer`](https://www.npmjs.com/package/puppeteer) | >500k | [Google Chrome](https://github.com/GoogleChrome/puppeteer#readme) |
| [`sqlite`](https://www.npmjs.com/package/sqlite) | >20k | |
| [`ts-node`](https://www.npmjs.com/package/ts-node) | >1M | |

It would be very visible if any of these packages, or their dependencies, were to be compromised.

You can compare this table with https://www.npmjs.com/package/beanni (NPM's view of Beanni's dependencies, based on the package we publish), or https://github.com/beanni/beanni/network/dependencies (GitHub's view of Beanni's dependencies, based on what's in source control).

We use Dependabot to ensure we adopt updates to these dependencies as fast as possible. [It's a busy little bot.](https://github.com/beanni/beanni/pulls?q=author%3Aapp%2Fdependabot)

## Development

Run it locally:

1. Clone
1. `npm install`
1. One of:
    * VS Code > `Ctrl+F5`
    * `npx ts-node .\src\app.ts --help`

To release (if you have the rights):
1. Clean git context
1. `npm version major|minor|patch`
1. `npm pack`
1. Validate the file list. ⚠ Make sure `config.yaml` or other dev-local files aren't in there.
1. `npm publish .\beanni-x.x.xx.tgz`
1. `git push`
1. `git push --tags`
