import {
    BankDataProviderInterface,
    AccountBalance
} from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Bankwest';

export class Bankwest implements BankDataProviderInterface {
    executionContext: FassExecutionContext;

    browser: puppeteer.Browser | undefined;
    page: puppeteer.Page | undefined;

    constructor(executionContext: FassExecutionContext) {
        this.executionContext = executionContext;
    }

    async login(retrieveSecretCallback: (key: string) => Promise<string>) {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug
        });
        var page = (this.page = await this.browser.newPage());

        const username = await retrieveSecretCallback('username');
        const password = await retrieveSecretCallback('password');

        await page.goto('https://ibs.bankwest.com.au/BWLogin/rib.aspx');

        await page.type('input[name="AuthUC$txtUserID"]', username);
        await page.type('input[type="password"]', password);
        await page.click("#AuthUC_btnLogin");

        await page.waitForSelector('[id$="lblWelcomeMessage"]');
    }

    async logout() {
        if (this.browser == null) throw "Not logged in yet";
        if (this.page == null) throw "Not logged in yet";
        var page = this.page;

        await page.goto('https://ibs.bankwest.com.au/CMWeb/Logout.aspx');
        await this.browser.close();
    }

    async getBalances(): Promise<Array<AccountBalance>> {
        if (this.page == null) throw "Not logged in yet";
        var page = this.page;

        const balances = new Array<AccountBalance>();

        await page.waitForSelector('table[id$=grdBalances] tbody tr');

        var accountSummaryRows = await page.$$('table[id$=grdBalances] tbody tr');
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval('td:nth-child(1)', (el: any) =>
                    el.textContent.trim()
                ),
                accountNumber: await row.$eval('td:nth-child(2)', (el: any) =>
                    el.textContent.trim()
                ),
                balance: parseFloat(
                    await row.$eval('td:nth-child(3)', (el: any) =>
                        el.textContent
                            .replace(/\s/g, '')
                            .replace('$', '')
                            .replace(',', '')
                    )
                )
            });
        }

        return balances;
    }
}
