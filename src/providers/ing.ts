import { BankDataProviderInterface, FassAccount } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

export class Ing implements BankDataProviderInterface {
    async getBalance(account : FassAccount, executionContext : FassExecutionContext): Promise<Number | null> {
        const browser = await puppeteer.launch({
            headless: !executionContext.debug,
            slowMo: 100
        });
        const page = await browser.newPage();
        await page.goto("https://www.ing.com.au/securebanking/");

        await page.waitForSelector('#cifField');
        if (executionContext.debug) { console.log('1'); }
        await page.type('#cifField', account.username);
        if (executionContext.debug) { console.log('2'); }
        await page.keyboard.press('Tab');
        if (executionContext.debug) { console.log('3'); }

        // Click the secret pixel that fires up the accessible login form
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-login-input input[type="image"].accessibleText');
            if (button != null) button.click();
        });
        //await page.click('.ing-login-input input[type="image"].accessibleText');
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        if (executionContext.debug) { console.log('4'); }

        // Type the PIN digit-by-digit
        for (const digit of account.password) {
            await page.evaluate(
                (d) => {
                    var button = <any>document.querySelector('.ing-accessible-login input[alt="' + d + '"]');
                    if (button != null) button.click();
                },
                digit
            );
            if (executionContext.debug) { console.log('5'); }
        }
        if (executionContext.debug) { console.log('6'); }

        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-accessible-login input[alt="Login"]');
            if (button != null) button.click();
        });
        if (executionContext.debug) { console.log('7'); }

        await page.waitForSelector('.uia-total-available-balance');
        if (executionContext.debug) { console.log('8'); }
        let balanceText = await page.$eval('.uia-total-available-balance', el => el.textContent);
        if (executionContext.debug) { console.log('9'); }

        await page.evaluate(() => {
            var button = <any>document.querySelector('button.uia-logout');
            if (button != null) button.click();
        });
        if (executionContext.debug) { console.log('10'); }
        await page.waitForSelector('.login-button');
        if (executionContext.debug) { console.log('11'); }

        await browser.close();

        if (balanceText == null) return null;

        let balance = parseFloat(balanceText.trim().replace('$', '').replace(',', ''));
        return balance;
    }
}
