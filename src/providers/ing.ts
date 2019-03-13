import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

const providerName = "ING";

export class Ing implements IBankDataProviderInterface {
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ) {
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
            const button =  document.querySelector('.ing-login-input input[type="image"].accessibleText') as any;
            if (button != null) { button.click(); }
        });
        await page.waitForSelector('.ing-accessible-login input[alt="1"]');
        this.debugLog("login", 3);

        // Type the PIN digit-by-digit on their virtual keypad
        for (const digit of password) {
            await page.evaluate((d) => {
                const button =  document.querySelector('.ing-accessible-login input[alt="' + d + '"]') as any;
                if (button != null) { button.click(); }
            }, digit);
            this.debugLog("login", 4);
        }
        this.debugLog("login", 5);

        // Click the login button
        await page.evaluate(() => {
            const button =  document.querySelector('.ing-accessible-login input[alt="Login"]') as any;
            if (button != null) {
                button.click();
            }
        });
        this.debugLog("login", 6);
    }

    public async logout() {
        if (this.browser == null) { throw new Error("Not logged in yet"); }
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.evaluate(() => {
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
            // @ts-ignore
            const componentData = document.querySelector("ing-all-accounts-summary").__data__;
            return typeof(componentData.accountSummaryData) !== "undefined";
        });
        this.debugLog("getBalances", 2);

        // Pull structured data straight off the Polymer component
        const accounts = await page.$eval("ing-all-accounts-summary", (el: any) =>
            el.__data__.accountSummaryData.Categories.flatMap((cat: any) => cat.Accounts),
        );
        for (const account of accounts) {
            balances.push({
                institution: providerName,
                accountName: account.AccountName,
                accountNumber: account.AccountNumber,
                balance: account.CurrentBalance,
            });
        }
        this.debugLog("getBalances", 2);

        return balances;
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
