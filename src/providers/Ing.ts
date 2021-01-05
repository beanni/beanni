import fs = require("fs");
import puppeteer = require("puppeteer");
import request = require("request");
import { URL } from "url";
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataDocumentProviderInterface, IBankDataProviderInterface } from "../types";

const providerName = "ING";

export class Ing implements IBankDataProviderInterface, IBankDataDocumentProviderInterface {
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
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        this.debugLog("getBalances", 0);

        // ING uses web components / Polymer, so we get nice and stable tag names
        await page.waitForSelector("ing-all-accounts-summary");
        this.debugLog("getBalances", 1);

        // Wait for the AJAX load to complete
        await page.waitForFunction(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const componentData = (<any>document.querySelector("ing-all-accounts-summary"))?.__data__;
            return typeof(componentData.accountSummaryData) !== "undefined";
        });
        this.debugLog("getBalances", 2);

        // Pull structured data straight off the Polymer component
        const accounts = await page.$eval("ing-all-accounts-summary", (el) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (<any>el).__data__.accountSummaryData.Categories.flatMap((cat: any) => cat.Accounts),
        );
        for (const account of accounts) {
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

    public async getDocuments(statementFolderPath: string): Promise<void> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        // Navigate to the e-Statements page
        await page.waitForSelector("ing-menu");
        await page.click('ing-menu [data-target="#navigation-finance"]');
        await page.click('ing-menu [data-target="#navigation-estatements"]');
        this.debugLog("getDocuments", 1);

        // Wait for the modules to load
        await page.waitForSelector("ing-estatements");
        await page.waitForSelector("ing-estatements-filters");
        await page.waitForSelector("ing-estatements-filters ing-accounts-dropdown-simple");

        // Wait for the AJAX load to complete
        await page.waitForFunction(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((<any>document.querySelector("ing-estatements"))?.__data__.eligibleAccountsLoading === false)
        );
        this.debugLog("getDocuments", 2);

        // Find available accounts
        const availableAccounts = await page.$eval(
            "ing-estatements-filters",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (el: any) => el.accounts,
        );
        for (const account of availableAccounts) {
            await this.getDocumentsForAccount(page, account, statementFolderPath);
            this.debugLog("getDocuments", 3);
        }
        this.debugLog("getDocuments", 4);
    }

    private async getDocumentsForAccount(
        page: puppeteer.Page,
        account: { AccountNumber: string; },
        statementFolderPath: string,
    ) {
        // Filter to this account, and longest period available
        await page.$eval(
            "ing-estatements-filters",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (el: any, accountNumber: string) => {
                el.selectAccountByNumber(accountNumber);
                el.selectedPeriodIndex = (el.periods.length - 1);
            },
            account.AccountNumber,
        );
        this.debugLog("getDocumentsForAccount:" + account.AccountNumber, 0);

        // Find all of the statements
        await page.click("ing-estatements #findButton");
        this.debugLog("getDocumentsForAccount:" + account.AccountNumber, 1);

        // Wait for the AJAX load to complete
        await page.waitForFunction(
            (accountNumber) => {
                return true &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ((<any>document.querySelector("ing-estatements"))?.__data__.estatementsLoading === false) &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ((<any>document.querySelector("ing-estatements-results"))?.__data__.accountNumber === accountNumber);
            },
            { timeout: 60000 },
            account.AccountNumber,
        );
        this.debugLog("getDocumentsForAccount:" + account.AccountNumber, 2);

        // Pull the data out of the page
        const statementsResultsData = await page.$eval(
            "ing-estatements-results",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (el: any) => el.__data__,
        );

        const apiEndpoint = new URL(
            statementsResultsData.globalServices.getEstatementDocument,
            "https://www.ing.com.au/",
        );

        for (const statement of statementsResultsData.data.Items) {
            const filename = `${statement.EndDate} ING ${account.AccountNumber} Statement ${statement.Id}.pdf`;
            const targetPath = statementFolderPath + `${filename}`;

            const exists = await new Promise<boolean>((resolve) => {
                fs.access(targetPath, fs.constants.F_OK, (err) => {
                    resolve(err === null);
                });
            });
            if (exists) {
                console.log(`[Ing] Skipping download; already on disk: ${filename}`);
                continue;
            }

            await new Promise<void>((resolve) => {
                const file = fs.createWriteStream(targetPath);
                request
                    .post({
                        uri: apiEndpoint,
                        form: {
                            "X-AuthToken": statementsResultsData.token,
                            "Id": statement.Id,
                            "AccountNumber": statementsResultsData.accountNumber,
                            "ProductName": statementsResultsData.productName,
                        },
                        headers: {
                            Referer: "https://www.ing.com.au/securebanking/",
                        },
                    })
                    .on("response", (res) => {
                        res.on("close", () => {
                            file.close();
                            console.log(`[Ing] Statement downloaded: ${filename}`);
                            resolve();
                        });
                    })
                    .pipe(file);
            });

            this.debugLog("getDocumentsForAccount:" + account.AccountNumber, 3);
        }
        this.debugLog("getDocumentsForAccount:" + account.AccountNumber, 6);
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
