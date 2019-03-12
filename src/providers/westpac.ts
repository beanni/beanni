import { BankDataProviderInterface, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Westpac';

export class Westpac implements BankDataProviderInterface {
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
        await page.goto("https://banking.westpac.com.au/wbc/banking/handler?fi=wbc&TAM_OP=login&segment=personal&logout=false");
        await page.waitForSelector('#fakeusername');
        await page.type('#fakeusername', username);
        await page.type('#password', password);
        await page.click('#signin');
        await page.waitForSelector('#customer-actions');
    }

    async logout() {
        if (this.browser == null) throw 'Not logged in yet';
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        await page.goto("https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=logout");
        await page.waitForSelector('#logout');

        await this.browser.close();
    }

    async getBalances() : Promise<Array<AccountBalance>>
    {
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        const balances = new Array<AccountBalance>();

        // The dasboard layout is user-selectable; force it to list view
        await page.goto("https://banking.westpac.com.au/secure/banking/accounts/getsummarystartpage?viewType=Summary");
        await page.waitForSelector('.accounts-summarylistwidget table');

        var accountSummaryRows = await page.$$('.accounts-summarylistwidget table > tbody > tr');
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval('.tf-account-detail a span', (el:any) => el.textContent.trim()),
                accountNumber: await row.$eval('.tf-account-detail div > span', (el:any) => el.innerText.split('\n')[1]),
                balance: parseFloat(await row.$eval('.balance.current .balance', (el:any) => el.textContent.trim().replace('minus', '').replace('$', '').replace(',', '')))
            });
        }

        return balances;
    }
}
