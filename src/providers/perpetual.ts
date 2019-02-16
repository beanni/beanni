import { BankDataProviderInterface, FassAccount } from '../types';
import puppeteer = require('puppeteer');

export class Perpetual implements BankDataProviderInterface {
    async getBalance(account : FassAccount): Promise<Number | null> {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto("https://www.perpetual.com.au/loginsecure");

        await page.waitForSelector('#onlineIDTextBox');
        await page.type('#onlineIDTextBox', account.username);
        await page.type('#passwordTextBox', account.password);
        await page.click('#loginButton');

        await page.waitForSelector('#accountSummaryTbl .total');
        let balanceText = await page.$eval('#accountSummaryTbl .total', el => el.textContent);

        await page.goto("https://secure.perpetual.com.au/LogoutCancelSession.aspx");
        await page.waitForSelector('#onlineIDTextBox');

        await browser.close();

        if (balanceText == null) return null;

        let balance = parseFloat(balanceText.trim().replace('$', '').replace(',', ''));
        return balance;
    }
}
