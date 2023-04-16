# Beanni

Your friendly Australian bean-counter, [Beanni](https://www.youtube.com/watch?v=Aey_zIE3K9E).

[![GitHub contributors](https://img.shields.io/github/contributors/beanni/beanni.svg)](https://github.com/beanni/beanni/graphs/contributors)
[![Build Status](https://github.com/beanni/beanni/workflows/Continuous%20Integration/badge.svg?branch=main)](https://github.com/beanni/beanni/actions?query=workflow%3A%22Continuous+Integration%22)

By [@mjhilton](https://github.com/mjhilton) and [@tathamoddie](https://github.com/tathamoddie).

Beanni helps gather financial data from all of your various institutions. Having all of this cached in a local database allows you to do deeper analysis than typical online banking tools would allow, such as portfolio-wide net-wealth trends.

Beanni is just a local helper, on your own machine. You're not sharing your passwords with us, or anybody else. You're not reverse engineering your bank. Beanni is just a robot that's really fast at clicking the same export buttons that you would otherwise have to click manually.

## Usage

### 🆕 First Run

Get started:

| Step | Run | Why |
| --- | --- | --- |
| 1. | https://nodejs.org/en/download/ | Beanni is built on Node.js |
| 2. | `node --version` | Make sure you're on Node ≥14.17.5 |
| 3. | `npm --version` | Make sure you're on NPM ≥6.14.14 |
| 4. | `git clone https://github.com/beanni/beanni.git` <br/> `cd beanni` | Pull down the latest version of Beanni |
| 5. | `npm install` | Install Beanni's dependencies |
| 6. | `npm run build` | Build Beanni | 
| 6. | `npm run init` | Create an example `config.yaml` |
| 7. | Edit `config.yaml` | Add your own banking relationships |
| 8. | `npm run fetch` | Grab your data |
| 9. | `npm run explore` | Launch the analysis UI |

### ⚒ Ongoing Usage (Manual)

Fetch and explore your data:

| Step | Run | Why |
| --- | --- | --- |
| 1. | `npm run fetch` | Grab your data |
| 2. | `npm run explore` | Launch the analysis UI |

### ⚙ Ongoing Usage (Automated, Linux)

Beanni works best when you're building up long-term data trends.

Setup a cronjob to fetch your data on a regular basis. Twice a day gives the best resilience (you'll get daily data points, with a long recovery window for any provider outages / maintenance windows).

```
~ $ crontab -e

0 5 * * * (cd ~/beanni; npm run fetch >> cron.log 2>&1;)
0 17 * * * (cd ~/beanni; npm run fetch >> cron.log 2>&1;)
```

Keep the web interface running as a service, so that it's always available:

```
~ $ sudo nano /etc/systemd/system/beanni.service

[Unit]
Description=Beanni explore server
After=network.target

[Service]
Type=simple
User=matttat
WorkingDirectory=/home/myuser/beanni
ExecStart=npm run explore
Restart=on-failure

[Install]
WantedBy=multi-user.target

~ $ sudo systemctl enable beanni
```

### 🆕 Updating Beanni

Get the latest updates:

| Step | Run | Why |
| --- | --- | --- |
| 1. | `git pull --ff-only` | Update Beanni to the latest version |
| 2. | `npm install` | Install any new dependencies |
| 3. | `npm run build` | Build Beanni |

If you've configured Beanni to run as a service, restart that too. (Probably via `$ sudo systemctl restart beanni`).

### 🗑 Uninstall

1. Remove secrets from your operating system's credential store
    * Windows:
        1. <kbd>WinKey</kbd> > _credential manager_
        1. _Windows Credentials_
        1. _Generic Credentials_
        1. Look for anything that starts with `Beanni:`
    * MacOS: Keychain
    * Headless environment: `~/.beanni/secrets.yaml`
1. Remove your data from the local working folder, specifically:
    * `beanni.db` (the database contains bank account numbers and financial data)
    * `config.yaml` (your provider listing)
    * `statements/` (folder cache of downloaded statements)
1. Remove the local working folder

### 👩‍💻 API

There are two REST endpoints exposed while `npm run explore` is running:

`/api/netWealth` returns a JSON object like `{"netWealth":12345.67}`

`/api/dataIssues` returns a JSON object like `{"count":1}`

These can be integrated into a platform like [Home Assistant](https://www.home-assistant.io/), via a REST sensor:

```yaml
sensor:
  - platform: rest
    resource: http://host:3000/api/netWealth
    name: Net Wealth
    value_template: "{{ value_json.netWealth }}"
    device_class: monetary
    unit_of_measurement: $
  - platform: rest
    resource: http://host:3000/api/dataIssues
    name: Beanni Data Issues
    value_template: "{{ value_json.count }}"
```

And then you can use [Home Assistant](https://www.home-assistant.io/) to deliver a push notification to you whenever there's a noteworthy balance movement, or if you have stale balances (because a provider is persistently failing):

```yaml
automation:
- id: net_wealth_event
  alias: "[Beanni] Net Wealth Event"
  trigger:
    - platform: state
      entity_id: sensor.net_wealth
  condition:
    condition: and
    conditions:
      - alias: "Old state was a number"
        condition: template
        value_template: "{{ trigger.from_state.state|float > 0 }}"
      - alias: "New state is a number"
        condition: template
        value_template: "{{ trigger.to_state.state|float > 0 }}"
      - alias: "Only events >$1k"
        condition: template
        value_template: "{{ (((trigger.from_state.state|float) - (trigger.to_state.state|float)) | abs) > 1000 }}"
  action:
    - service: notify.everyone
      data_template:
        title: 🤑 Financial Event
        message: "{{ 'Positive' if (trigger.to_state.state|float) > (trigger.from_state.state|float) else 'Negative' }} net wealth movement"
        clickAction: http://host:3000/
        data:
          channel: Beanni

- id: beanni_data_issues
  alias: "[Beanni] Data Issues"
  trigger:
    - platform: state
      entity_id: sensor.beanni_data_issues
  condition: "{{ trigger.to_state.state|int > 0 }}"
  action:
    - service: notify.everyone
      data_template:
        title: ⚠️ Beanni Data Issues
        message: Requires investigation
        clickAction: http://host:3000/
        data:
          channel: Beanni
```

## Security, by design

### 💻 Execution Environment

Beanni all runs locally on your own machine, or your own hosting. There are no shared web services in play.

### 🤫 Secret Storage

Secrets are kept out of configuration files entirely, by design.

Secrets are stored in your operating system's credential store (Credential Manager on Windows, or Keychain on MacOS). We use [keytar](https://www.npmjs.com/package/keytar) to do this, which is [built and maintained by the Atom project](https://github.com/atom/node-keytar).

Beanni will seek credentials during your first fetch. If you're running on an interactive command line, it'll prompt you, then store these values in your operating system's credential store. If you're running in a context where this doesn't work, such as headless execution, or without a compatible store, Beanni will give guidance about configuring a secrets file.

### 📦 Dependency Supply Chain

Our dependency supply chain is the biggest risk. We've been careful to keep our [package.json](package.json) dependencies list short, and highly trustworthy:

| Package | Weekly Package Downloads (Jan 2021) | Known/Trusted Maintainer |
| --- | --- | --- |
| [`commander`](https://www.npmjs.com/package/commander) | >40M | |
| [`express`](https://www.npmjs.com/package/express) | >10M | |
| [`inquirer`](https://www.npmjs.com/package/inquirer) | >20M | |
| [`js-yaml`](https://www.npmjs.com/package/js-yaml) | >20M | |
| [`keytar`](https://www.npmjs.com/package/keytar) | >100k | [Atom](https://github.com/atom/node-keytar) |
| [`lodash`](https://www.npmjs.com/package/lodash) | >30M | |
| [`pug`](https://www.npmjs.com/package/pug) | >750k | |
| [`puppeteer`](https://www.npmjs.com/package/puppeteer) | >1.5M | [Google Chrome](https://github.com/GoogleChrome/puppeteer#readme) |
| [`request`](https://www.npmjs.com/package/request) | >20M | |
| [`sqlite`](https://www.npmjs.com/package/sqlite) | >60k | |
| [`ts-node`](https://www.npmjs.com/package/ts-node) | >6M | |

It would be very visible if any of these packages, or their dependencies, were to be compromised.

You can compare this table with https://github.com/beanni/beanni/network/dependencies (GitHub's view of Beanni's dependencies, based on what's in source control).

We use Dependabot to ensure we adopt updates to these dependencies as fast as possible. [It's a busy little bot.](https://github.com/beanni/beanni/pulls?q=author%3Aapp%2Fdependabot)

## Development

### 👩‍💻 Local Execution

1. `git clone https://github.com/beanni/beanni.git`
1. `npm install`
1. VS Code > <kbd>Ctrl</kbd>+<kbd>F5</kbd>

### 🌲 Dependencies

For a smooth `npm install`:

* On Ubuntu, [LibSecret needs to be installed](https://github.com/atom/node-keytar#on-linux) for [Keytar](https://www.npmjs.com/package/keytar) to `npm install` properly

* [sqlite3](https://www.npmjs.com/package/sqlite3) requires a native binary. `npm install` will attempt to resolve a pre-compiled binary for the right combination of your OS, architecture, and node version via `node-pre-gyp`. If this fails, it'll then attempt to compile from source which will then throw up new dependencies for Python and a C++ compiler. You're probably better off getting the pre-compiled binary option to work instead of trying to install the required compiler toolchain. If you want to pursue the build tools on Windows, try `npm install --vs2015 --global --production --add-python-to-path windows-build-tools` from an elevated prompt.

### 🤖 Puppeteer Debugging

Running `npm run fetch -- --debug` will keep the browser visible during execution, and write out more logs.

In VS Code, you can <kbd>F5</kbd> > `explore` > `--debug` to both apply this flag and attach a debugger to the process.
