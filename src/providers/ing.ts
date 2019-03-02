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
            slowMo: 100
        });
        var page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback('username');
        const password = await retrieveSecretCallback('password');

        await page.goto("https://www.ing.com.au/securebanking/");
        await page.waitForSelector('#cifField');
        if (this.executionContext.debug) {
            console.log('1');
        }
        await page.type('#cifField', username);
        if (this.executionContext.debug) {
            console.log('2');
        }
        await page.keyboard.press('Tab');
        if (this.executionContext.debug) {
            console.log('3');
        }
        // Click the secret pixel that fires up the accessible login form
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-login-input input[type="image"].accessibleText');
            if (button != null)
                button.click();
        });
        //await page.click('.ing-login-input input[type="image"].accessibleText');
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        if (this.executionContext.debug) {
            console.log('4');
        }
        // Type the PIN digit-by-digit
        for (const digit of password) {
            await page.evaluate((d) => {
                var button = <any>document.querySelector('.ing-accessible-login input[alt="' + d + '"]');
                if (button != null)
                    button.click();
            }, digit);
            if (this.executionContext.debug) {
                console.log('5');
            }
        }
        if (this.executionContext.debug) {
            console.log('6');
        }
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-accessible-login input[alt="Login"]');
            if (button != null)
                button.click();
        });
        if (this.executionContext.debug) {
            console.log('7');
        }
    }

    async logout() {
        if (this.browser == null) throw 'Not logged in yet';
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        await page.evaluate(() => {
            var button = <any>document.querySelector('button.uia-logout');
            if (button != null)
                button.click();
        });
        if (this.executionContext.debug) {
            console.log('10');
        }
        await page.waitForSelector('.login-button');
        if (this.executionContext.debug) {
            console.log('11');
        }

        await this.browser.close();
    }

    async getBalances() : Promise<Array<AccountBalance>>
    {
        if (this.page == null) throw 'Not logged in yet';
        var page = this.page;

        const balances = new Array<AccountBalance>();

        await page.waitForSelector('ing-page-block.ing-all-accounts-summary');
        if (this.executionContext.debug) { console.log('8'); }

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
}
