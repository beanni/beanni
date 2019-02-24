import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Asgard';

export class Asgard implements BankDataProviderInterface {
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

            await page.waitForSelector('b');

            var tables = await page.$x('//b[contains(text(), "Account type")]/ancestor::table[tbody/tr/td/b]');
            var table = (tables)[0];
            var rows = await table.$$('tr:not([bgColor])');
            for (const row of rows) {
                var cells = await row.$$('td');
                if (cells.length !== 3) continue;

                var cellText = await Promise.all(cells.map(async (c:any) => {
                    var handle = await c.getProperty('textContent');
                    var value = await handle.jsonValue();
                    return value.trim();
                }));

                if (cellText[0] === 'TOTAL') continue;
                if (cellText[1] === '') continue;

                balances.push({
                    institution: providerName,
                    accountName: cellText[0],
                    accountNumber: cellText[1],
                    balance: parseFloat(cellText[2].trim().replace('$', '').replace(',', ''))
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
        await page.goto('https://www.investoronline.info/iol/iollogon/logon.jsp');
        await page.waitForSelector('input[type=text]');
        await page.type('input[type=text]', username);
        await page.type('input[type=password]', password);
        await page.click('input[type=submit][value=Login]');
    }

    private async logout(page: puppeteer.Page) {
        await page.goto('https://www.investoronline.info/iol/iollogon/logout_transfer.jsp');
    }
}
