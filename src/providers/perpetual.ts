import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Perpetual';

export class Perpetual implements BankDataProviderInterface {
    async getBalances(
            relationship : FassInstitutionRelationship,
            executionContext : FassExecutionContext,
            retrieveSecretCallback : (key : string) => Promise<string>
        ) : Promise<Array<AccountBalance>> {
        const balances = new Array<AccountBalance>();
        const browser = await puppeteer.launch({
            headless: !executionContext.debug
        });
        const page = await browser.newPage();

        try
        {
            await this.login(page, retrieveSecretCallback);

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
        }
        finally
        {
            await this.logout(page);
            await browser.close();
        }

        return balances;
    }

    private async login(
            page: puppeteer.Page,
            retrieveSecretCallback : (key : string) => Promise<string>
        ) {
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

    private async logout(page: puppeteer.Page) {
        await page.goto("https://secure.perpetual.com.au/LogoutCancelSession.aspx");
        await page.waitForSelector('input[type=submit][value=Login]');
    }
}
