import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface, IBankDataHistoricalBalancesProviderInterface, IHistoricalAccountBalance } from "../types";
import _ from "lodash";

const providerName = "INGSuper";

export class IngSuper implements IBankDataProviderInterface, IBankDataHistoricalBalancesProviderInterface {
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }
    
    public async login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,

            // ING's banking is heavily client-side, with dynamic Polymer components popping in and out
            slowMo: 100,
        });
        const page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        await page.goto("https://www.ing.com.au/securebanking/");
        await page.waitForSelector("#cifField");
        this.debugLog("login", 1);

        // Fill the username, then tab out to trigger their client-side validation
        await page.type("#cifField", username);
        await page.keyboard.press("Tab");
        this.debugLog("login", 2);

        // Click the secret pixel that fires up the accessible login form
        // For some reason, puppeteer's native page.click doesn't achieve the same result as evaluating in-page
        await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const button =  document.querySelector('.ing-login-input input[type="image"].accessibleText') as any;
            if (button != null) { button.click(); }
        });
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        this.debugLog("login", 3);

        // Type the PIN digit-by-digit on their virtual keypad
        for (const digit of password) {
            await page.evaluate((d) => {
                const button =  document.querySelector('.ing-accessible-login input[alt="' + d + '"]') as HTMLButtonElement;
                if (button != null) { button.click(); }
            }, digit);
            this.debugLog("login", 4);
        }
        this.debugLog("login", 5);

        // Click the login button
        await page.evaluate(() => {
            const button =  document.querySelector('.ing-accessible-login input[alt="Login"]') as HTMLButtonElement;
            if (button != null) { button.click(); }
        });
        this.debugLog("login", 6);
    }

    public async logout(): Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const button =  document.querySelector("button.uia-logout") as any;
            if (button != null) { button.click(); }
        });
        this.debugLog("logout", 1);

        await page.waitForSelector(".login-button");
        this.debugLog("login", 2);

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }

        const balances = new Array<IAccountBalance>();

        const superAccounts = await this.getSuperannuationAccounts();

        for (const account of superAccounts) {
            balances.push({
                institution: providerName,
                accountName: account.AccountName ?? account.ProductName,
                accountNumber: account.AccountNumber,
                balance: account.CurrentBalance,
            });
        }
        this.debugLog("getBalances", 2);

        return balances;
    }

    async getHistoricalBalances(knownDates: Date[]): Promise<IHistoricalAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        if (this.browser == null) { throw new Error("Browser not initialised"); }
        const browser = this.browser;

        const formattedDate = (d: Date) => d.toISOString().substring(0, 10);

        knownDates = _(knownDates)
            .sortedUniqBy(formattedDate)
            .value();
        const datesToLookup = new Array<Date>();

        // Find gaps in the existing date series
        if (knownDates.length > 0) {
            const earliestDate = knownDates[0];
            const latestDate = knownDates[knownDates.length-1];
            const fullDateSeries = new Array<Date>();
            for (let cursor = new Date(earliestDate); cursor < latestDate; cursor.setDate(cursor.getDate() + 1)) {
                fullDateSeries.push(new Date(cursor));
            }
            _(fullDateSeries)
                .differenceBy(knownDates, formattedDate)
                .sortedUniqBy(formattedDate)
                .forEach(d => datesToLookup.push(d));
        }
        console.log(`[${providerName}] There are ${datesToLookup.length} historical data points to attempt to get`);

        const maxHistoricalBatchSize = 30;
        if (datesToLookup.length > maxHistoricalBatchSize) {
            console.log(`[${providerName}] Limiting to ${maxHistoricalBatchSize} data points in this batch`);
            datesToLookup.splice(maxHistoricalBatchSize);
        }

        const historicalBalances = new Array<IHistoricalAccountBalance>();
        if (datesToLookup.length === 0) return historicalBalances;

        const superAccounts = await this.getSuperannuationAccounts();
        
        // For each Super account
        for await (const account of superAccounts) {
            const superPopupPromise = new Promise<puppeteer.Page>(x => browser.once('targetcreated', target => x(target.page())));	
            await page.click(`[accountNo='${account.AccountNumber}']`);	
            const superPage = await superPopupPromise;

            await superPage.click('.navBarContent .navbar-toggle');
            await superPage.click('.menu-item.AccountList_Wrapper a');
            await superPage.waitFor(() => !!document.querySelector("body:not(.loading)"));

            await superPage.click('.navBarContent .navbar-toggle');
            await superPage.click('.child-menu-item.TransactionHistory a');
            await superPage.waitFor(() => !!document.querySelector("body:not(.loading)"));

            for await (const dateToLookup of datesToLookup) {
                const startDate = new Date(dateToLookup);
                startDate.setDate(dateToLookup.getDate() - 3);

                const dmyFormat = (date: Date) => `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                console.log(`[${providerName}] Getting historical data for ${dmyFormat(dateToLookup)}`);
                
                await superPage.focus('.transactionHistoryFilterForm .startDate .gwt-TextBox');
                await superPage.$eval('.transactionHistoryFilterForm .startDate .gwt-TextBox', el => (<HTMLInputElement>el).value = '');
                await superPage.type('.transactionHistoryFilterForm .startDate .gwt-TextBox', dmyFormat(startDate));
                await superPage.keyboard.press("Tab");

                await superPage.focus('.transactionHistoryFilterForm .endDate .gwt-TextBox');
                await superPage.$eval('.transactionHistoryFilterForm .endDate .gwt-TextBox', el => (<HTMLInputElement>el).value = '');
                await superPage.type('.transactionHistoryFilterForm .endDate .gwt-TextBox', dmyFormat(dateToLookup));
                await superPage.keyboard.press("Tab");

                await superPage.click('.transactionHistoryFilterForm .Submit a');
                await superPage.waitFor(() => !!document.querySelector("body:not(.loading)"));

                try
                {
                    const accountValue = await superPage.$eval('.lastRow td.runningBalance', el => <string>((<HTMLElement>el).dataset.bgmlValue));
                    const balance = parseFloat(accountValue.trim().replace("$", "").replace(",", ""));
    
                    historicalBalances.push({
                        institution: providerName,
                        accountName: account.ProductName,
                        accountNumber: account.AccountNumber,
                        balance: balance,
                        date: new Date(dateToLookup),
                    });
                }
                catch
                {
                    console.log(`[${providerName}] Failed to get historical data for ${dmyFormat(dateToLookup)}`)
                }
            }
        }

        return historicalBalances;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async getSuperannuationAccounts() : Promise<any> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        // ING uses web components / Polymer, so we get nice and stable tag names
        await page.waitForSelector("ing-all-accounts-summary");

        // Wait for the AJAX load to complete
        await page.waitForFunction(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const componentData = (<any>document.querySelector("ing-all-accounts-summary"))?.__data__;
            return typeof(componentData.accountSummaryData) !== "undefined";
        });

        // Pull structured data straight off the Polymer component
        const superannuationAccounts = await page.$eval("ing-all-accounts-summary", (el) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (<any>el).__data__.accountSummaryData.Categories.filter((cat: any) => cat.Category.Name === "Superannuation").flatMap((cat: any) => cat.Accounts)
        );

        return superannuationAccounts;
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
