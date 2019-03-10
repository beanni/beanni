import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Asgard';

export class Asgard implements BankDataProviderInterface {
    executionContext: FassExecutionContext;

    browser: puppeteer.Browser | undefined;
    page: puppeteer.Page | undefined;

    constructor(executionContext : FassExecutionContext)
    {
        this.executionContext = executionContext;
    }

    async login(
        retrieveSecretCallback : (key : string) => Promise<string>
    ) {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        var page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback('username');
        const password = await retrieveSecretCallback('password');

        await page.goto('https://www.investoronline.info/iol/iollogon/logon.jsp');
        await page.waitForSelector('input[type=text]');
        this.debugLog('login', 1);

        await page.type('input[type=text]', username);
        await page.type('input[type=password]', password);
        this.debugLog('login', 2);

        await page.click('input[type=submit][value=Login]');
        this.debugLog('login', 3);

        await page.waitForSelector('#logoutButton');
        this.debugLog('login', 4);
    }

    async logout() {
        if (this.browser == null) throw 'Not logged in yet';
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        await page.goto('https://www.investoronline.info/iol/iollogon/logout_transfer.jsp');
        this.debugLog('logout', 1);

        await this.browser.close();
    }

    async getBalances() : Promise<Array<AccountBalance>>
    {
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        const balances = new Array<AccountBalance>();

        this.debugLog('getBalances', 0);

        await page.click('#headerLogo img');
        this.debugLog('getBalances', 1);

        await page.waitForSelector('b');
        this.debugLog('getBalances', 1);

        var tables = await page.$x('//b[contains(text(), "Account type")]/ancestor::table[tbody/tr/td/b]');
        var table = (tables)[0];
        var rows = await table.$$('tr:not([bgColor])');
        for (const row of rows) {
            var cells = await row.$$('td');
            if (cells.length !== 3) continue;

            var cellText = await Promise.all(cells.map(async (c:any) => {
                var handle = await c.getProperty('textContent');
                var value = await handle.jsonValue();
                return value.trim();
            }));

            if (cellText[0] === 'TOTAL') continue;
            if (cellText[1] === '') continue;

            balances.push({
                institution: providerName,
                accountName: cellText[0],
                accountNumber: cellText[1],
                balance: parseFloat(cellText[2].trim().replace('$', '').replace(',', ''))
            });
        }

        return balances;
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log('%s: %s', stage, position.toString());
        }
    }
}
