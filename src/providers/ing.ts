import { BankDataProviderInterface, FassAccount } from '../types';
import puppeteer = require('puppeteer');

export class Ing implements BankDataProviderInterface {
    async getBalance(account : FassAccount): Promise<Number | null> {
        const browser = await puppeteer.launch({slowMo: 100});
        const page = await browser.newPage();
        await page.goto("https://www.ing.com.au/securebanking/");

        await page.waitForSelector('#cifField');
        console.log('1');
        await page.type('#cifField', account.username);
        console.log('2');
        await page.keyboard.press('Tab');
        console.log('3');

        // Click the secret pixel that fires up the accessible login form
        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-login-input input[type="image"].accessibleText');
            if (button != null) button.click();
        });
        //await page.click('.ing-login-input input[type="image"].accessibleText');
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        console.log('4');

        // Type the PIN digit-by-digit
        for (const digit of account.password) {
            await page.evaluate(
                (d) => {
                    var button = <any>document.querySelector('.ing-accessible-login input[alt="' + d + '"]');
                    if (button != null) button.click();
                },
                digit
            );
            console.log('5');
        }
        console.log('6');

        await page.evaluate(() => {
            var button = <any>document.querySelector('.ing-accessible-login input[alt="Login"]');
            if (button != null) button.click();
        });
        console.log('7');

        await page.waitForSelector('.uia-total-available-balance');
        console.log('8');
        let balanceText = await page.$eval('.uia-total-available-balance', el => el.textContent);
        console.log('9');

        await page.evaluate(() => {
            var button = <any>document.querySelector('button.uia-logout');
            if (button != null) button.click();
        });
        console.log('10');
        await page.waitForSelector('.login-button');
        console.log('11');

        await browser.close();

        if (balanceText == null) return null;

        let balance = parseFloat(balanceText.trim().replace('$', '').replace(',', ''));
        return balance;
    }
}
