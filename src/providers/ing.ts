import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'ING';

export class Ing implements BankDataProviderInterface {
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

            // ING's banking is heavily client-side, with dynamic Polymer components popping in and out
            slowMo: 100
        });
        var page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback('username');
        const password = await retrieveSecretCallback('password');

        await page.goto("https://www.ing.com.au/securebanking/");
        await page.waitForSelector('#cifField');
        this.debugLog('login', 1);

        // Fill the username, then tab out to trigger their client-side validation
        await page.type('#cifField', username);
        await page.keyboard.press('Tab');
        this.debugLog('login', 2);

        // Click the secret pixel that fires up the accessible login form
        // For some reason, puppeteer's native page.click doesn't achieve the same result as evaluating in-page
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-login-input input[type="image"].accessibleText');
            if (button != null) { button.click(); }
        });
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        this.debugLog('login', 3);

        // Type the PIN digit-by-digit on their virtual keypad
        for (const digit of password) {
            await page.evaluate((d) => {
                var button = <any>document.querySelector('.ing-accessible-login input[alt="' + d + '"]');
                if (button != null) { button.click(); }
            }, digit);
            this.debugLog('login', 4);
        }
        this.debugLog('login', 5);

        // Click the login button
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-accessible-login input[alt="Login"]');
            if (button != null)
                button.click();
        });
        this.debugLog('login', 6);
    }

    async logout() {
        if (this.browser == null) throw 'Not logged in yet';
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        await page.evaluate(() => {
            var button = <any>document.querySelector('button.uia-logout');
            if (button != null) { button.click(); }
        });
        this.debugLog('logout', 1);

        await page.waitForSelector('.login-button');
        this.debugLog('login', 2);

        await this.browser.close();
    }

    async getBalances() : Promise<Array<AccountBalance>>
    {
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        const balances = new Array<AccountBalance>();

        this.debugLog('getBalances', 0);

        // ING uses web components / Polymer, so we get nice and stable tag names
        await page.waitForSelector('ing-page-block.ing-all-accounts-summary');
        this.debugLog('getBalances', 1);

        // ING seem to use 'uia-' as a prefix for their own UI Automation hooks; great for us!
        var accountSummaryRows = await page.$$('ing-page-block.ing-all-accounts-summary .uia-account-row');
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval('h3', (el:any) => el.textContent),
                accountNumber: await row.$eval('.acc .uia-account-number', (el:any) => el.textContent.trim()),
                balance: parseFloat(await row.$eval('.cb .uia-account-current-balance-desktop', (el:any) => el.textContent.trim().replace('$', '').replace(',', '')))
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
