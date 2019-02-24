# Beanni

Your friendly Australian bean-counter, [Beanni](https://www.youtube.com/watch?v=Aey_zIE3K9E).

Beanni helps gather financial data from all of your various providers, institutions, and banks. Having all of this cached in a local database allows you to do deeper analysis than typical online banking tools would allow, such as spend-by-merchant stats, or net-worth trends.

## Usage

Get it running in minutes:

1. Create a local folder for config and data
    * `mkdir beanni`
    * `cd beanni`
1. Create `config.yaml` and `beanni.db`
    * `npx beanni init`
1. Edit `config.yaml`
1. Gather your data
    * `npx beanni fetch`
1. Get insights
    * `npx beanni explore`

## Security

Beannie all runs locally on your own machine, or your own hosting. There are no shared web services in play.

Secrets are kept out of configuration files: `config.yaml` only has keys that point to secrets (e.g. `password: $secret my-bank-username-secret`).

Secrets are stored in your operating system's credential store (Credential Manager on Windows, or Keychain on MacOS). We use [keytar](https://www.npmjs.com/package/keytar) to do this.

Our dependency supply chain is the biggest risk. We've been careful to keep our [package.json](package.json) dependencies list short, and highly trustworthy:
* `commander` has >15M weekly downloads, and powers almost every node CLI app out there
* `inquirer` has ~10M weekly downloads, and powers almost every node CLI app out there
* `keytar` has >20k weekly downloads, and is [maintained by the Atom project](https://github.com/atom/node-keytar)
* `puppeteer` has >500k weekly downloads, and is [maintained by Google Chrome](https://github.com/GoogleChrome/puppeteer#readme)
* `sqlite` has >20k weekly downloads
* `ts-node` has >1M weekly downloads
* `yaml` has >50k weekly downloads
    * `@types/yaml` is [maintained by the DefinitelyTyped project](http://definitelytyped.org/)

## Development

Run it locally:

1. Clone
1. `npm install`
1. One of:
    * VS Code > `Ctrl+F5`
    * `npx ts-node .\src\app.ts --help`
