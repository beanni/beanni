import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class DefenceBank implements IBankDataProviderInterface {
    public institution = "DefenceBank";
    
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ) : Promise<void> {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        const page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        await page.goto("https://digital.defencebank.com.au/");
        await page.waitForSelector("input[name=MemberNumber]");
        this.debugLog("login", 1);

        await page.type("input[name=MemberNumber]", username);
        await page.type("input[type=password]", password);
        this.debugLog("login", 2);

        await page.click("[type=submit]");
        this.debugLog("login", 3);

        await page.waitForSelector(".main-content");
        this.debugLog("login", 4);
    }

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.goto("https://digital.defencebank.com.au/logout");
        this.debugLog("logout", 1);

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        this.debugLog("getBalances", 0);

        await page.waitForSelector(".nav-top-section .logo a");
        await page.click(".nav-top-section .logo a");
        this.debugLog("getBalances", 1);

        await page.waitForSelector("#accts .account-item");
        this.debugLog("getBalances", 2);

        const accountSummaryRows = await page.$$("#accts .account-item");
        for (const row of accountSummaryRows) {
            this.debugLog("getBalances", 3);
            balances.push({
                institution: this.institution,
                accountName: await row.$eval(".account-name", el => (el.textContent || '').trim()),
                accountNumber: await row.$eval(".account[data-acct]", (el) => (<HTMLElement>el).dataset.acct || ''),
                balance: parseFloat(
                    await row.$eval(
                        ".account-bal",
                        el => (el.textContent || '').trim().replace("$", "").replace(",", ""),
                    ),
                ),
            });
        }

        return balances;
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
