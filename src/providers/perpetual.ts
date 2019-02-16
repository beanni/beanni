import { BankDataProviderInterface } from '../types';
import puppeteer = require('puppeteer');

export class Perpetual implements BankDataProviderInterface {
    getBalance(): Number {
        return 123.45;
    }
}


// (async () => {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto("https://www.perpetual.com.au/loginsecure");
//     const title = await page.title();
//     console.log("Loaded page '%s'", title);

//     await browser.close();
// })();

