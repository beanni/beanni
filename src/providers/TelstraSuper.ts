import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface, ValueType } from "../types";

export class TelstraSuper implements IBankDataProviderInterface {
    public institution = "TelstraSuper";
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

        await page.goto("https://www.telstrasuper.com.au/login");
        await page.waitForSelector("input[type=text][name=MemberNumber]");
        this.debugLog("login", 1);

        await page.type("input[type=text][name=MemberNumber]", username);
        await page.type("input[type=password]", password);
        this.debugLog("login", 2);

        await page.click("form[action='/login'] button[type=submit]");
        this.debugLog("login", 3);

        await page.waitForSelector("main#main header h1");
        this.debugLog("login", 4);
    }

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.goto("https://www.telstrasuper.com.au/api/account/logout");
        this.debugLog("logout", 1);

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        this.debugLog("getBalances", 0);

        await page.goto("https://www.telstrasuper.com.au/your-account");
        this.debugLog("getBalances", 1);

        await page.waitForSelector(".dm-investments-table table tbody");
        this.debugLog("getBalances", 2);

        const accountName = (await page.$eval(
            ".dm-balance .dashboard-table table tbody tr:first-child td:first-child span:nth-child(1)",
            el => (el.textContent || '')
        ));
        this.debugLog("getBalances", 3);
        const accountNumber = (await page.$eval(
            ".dm-balance .dashboard-table table tbody tr:first-child td:first-child span:nth-child(2)",
            el => (el.textContent || '').replace("Account number: ", "")
        ));
        this.debugLog("getBalances", 4);

        const investmentAllocationTable = (await page.$x("//caption[contains(text(), 'Investment allocation')]/ancestor::table"))[0];
        const rows = await investmentAllocationTable.$$("tbody tr");
        this.debugLog("getBalances", 5);
        for (const row of rows) {
            this.debugLog("getBalances", 6);
            const option = await row.$eval("td[data-th='Option']", el => (el.textContent || '').trim())

            const valueText = await row.$eval("td[data-th='Value ($AUD)']", el => (el.textContent || '').trim())
            const value = parseFloat(valueText.replace(",", ""));

            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: accountNumber + ' ' + option,
                balance: value,
                valueType: ValueType.Superannuation,
            });
        }

        this.debugLog("getBalances", 7);
        return balances;
    }

   private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
