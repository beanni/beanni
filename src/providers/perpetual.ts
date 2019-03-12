import { BankDataProviderInterface, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Perpetual';

export class Perpetual implements BankDataProviderInterface {
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

        await page.goto("https://www.perpetual.com.au/loginsecure");
        const loginPageTitle = await page.title();
        if (loginPageTitle.includes('OpenAM')) {
            await page.waitForSelector('#IDToken1');
            await page.type('#IDToken1[type=text]', username);
            await page.type('#IDToken2[type=password]', password);
        }
        else {
            await page.waitForSelector('#onlineIDTextBox');
            await page.type('#onlineIDTextBox', username);
            await page.type('#passwordTextBox', password);
        }
        await page.click('input[type=submit][value=Login]');
    }

    async logout() {
        if (this.browser == null) throw 'Not logged in yet';
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        await page.goto("https://secure.perpetual.com.au/LogoutCancelSession.aspx");
        await page.waitForSelector('input[type=submit][value=Login]');

        await this.browser.close();
    }

    async getBalances() : Promise<Array<AccountBalance>>
    {
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        const balances = new Array<AccountBalance>();

        await page.waitForSelector('#accountSummaryTbl .total');

        var accountSummaryRows = await page.$$('#accountSummaryTbl > tbody > tr');
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval('.clientname', (el:any) => el.textContent.trim()),
                accountNumber: await row.$eval('.accountnumber', (el:any) => el.textContent.trim()),
                balance: parseFloat(await row.$eval('.accountvalue', (el:any) => el.textContent.trim().replace('$', '').replace(',', '')))
            });
        }

        return balances;
    }
}
