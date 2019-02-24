import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Myki';

export class Myki implements BankDataProviderInterface {
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

            await page.waitForSelector('#tabs-1 table.acc-tab-table tr a');

            var accountSummaryRows = await page.$$('#tabs-1 table.acc-tab-table tr');
            for (const row of accountSummaryRows) {
                // Skip the header row which is all made up of <th> elements
                if ((await row.$$('td')).length === 0) continue;

                balances.push({
                    institution: providerName,
                    accountName: await row.$eval('td:nth-child(2)', (el:any) => el.textContent.trim()),
                    accountNumber: await row.$eval('td a', (el:any) => el.textContent.trim()),
                    balance: parseFloat(await row.$eval('td:nth-child(3)', (el:any) => el.textContent.trim().replace('$', '').replace(',', '')))
                });
            }

            await this.logout(page);
        }
        finally
        {
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
        await page.goto('https://www.mymyki.com.au/NTSWebPortal/Login.aspx');
        await page.waitForSelector('input[name$=Username]');
        await page.type('input[name$=Username]', username);
        await page.type('input[name$=Password]', password);
        await page.click('input[type=submit][value=Login]');
    }

    private async logout(page: puppeteer.Page) {
        await page.click('input[name="ctl00$uxHeader$uxLoginImg"]');
    }
}
