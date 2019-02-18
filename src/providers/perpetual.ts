import { BankDataProviderInterface, FassAccount } from '../types';
import puppeteer = require('puppeteer');

export class Perpetual implements BankDataProviderInterface {
    async getBalance(account : FassAccount): Promise<Number | null> {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto("https://www.perpetual.com.au/loginsecure");

        await page.waitForSelector('#IDToken1');
        await page.type('#IDToken1[type=text]', account.username);
        await page.type('#IDToken2[type=password]', account.password);
        await page.click('input[type=submit][value=Login]');

        await page.waitForSelector('#accountSummaryTbl .total');
        let balanceText = await page.$eval('#accountSummaryTbl .total', el => el.textContent);

        await page.goto("https://secure.perpetual.com.au/LogoutCancelSession.aspx");
        await page.waitForSelector('#IDToken1');

        await browser.close();

        if (balanceText == null) return null;

        let balance = parseFloat(balanceText.trim().replace('$', '').replace(',', ''));
        return balance;
    }
}
