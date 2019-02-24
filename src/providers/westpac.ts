import { BankDataProviderInterface, FassInstitutionRelationship, AccountBalance } from '../types';
import puppeteer = require('puppeteer');
import { FassExecutionContext } from '../core';

const providerName = 'Westpac';

export class Westpac implements BankDataProviderInterface {
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

            await page.waitForSelector('#customer-actions');

            // The dasboard layout is user-selectable; force it to list view
            await page.goto("https://banking.westpac.com.au/secure/banking/accounts/getsummarystartpage?viewType=Summary");
            await page.waitForSelector('.accounts-summarylistwidget table');

            var accountSummaryRows = await page.$$('.accounts-summarylistwidget table > tbody > tr');
            for (const row of accountSummaryRows) {
                balances.push({
                    institution: providerName,
                    accountName: await row.$eval('.tf-account-detail a span', (el:any) => el.textContent.trim()),
                    accountNumber: await row.$eval('.tf-account-detail div > span', (el:any) => el.innerText.split('\n')[1]),
                    balance: parseFloat(await row.$eval('.balance.current .balance', (el:any) => el.textContent.trim().replace('minus', '').replace('$', '').replace(',', '')))
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
        await page.goto("https://banking.westpac.com.au/wbc/banking/handler?fi=wbc&TAM_OP=login&segment=personal&logout=false");
        await page.waitForSelector('#fakeusername');
        await page.type('#fakeusername', username);
        await page.type('#password', password);
        await page.click('#signin');
    }

    private async logout(page: puppeteer.Page) {
        await page.goto("https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=logout");
        await page.waitForSelector('#logout');
    }
}
