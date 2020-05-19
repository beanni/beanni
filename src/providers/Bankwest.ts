import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import {
    IAccountBalance,
    IBankDataProviderInterface,
} from "../types";

const providerName = "Bankwest";

export class Bankwest implements IBankDataProviderInterface {
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(retrieveSecretCallback: (key: string) => Promise<string>) {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        const page = (this.page = await this.browser.newPage());

        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        await page.goto("https://ibs.bankwest.com.au/BWLogin/rib.aspx");

        await page.type('input[name="AuthUC$txtUserID"]', username);
        await page.type('input[type="password"]', password);
        await page.click("#AuthUC_btnLogin");

        await page.waitForSelector('[id$="lblWelcomeMessage"]');
    }

    public async logout() {
        if (this.browser == null) { throw new Error("Not logged in yet"); }
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.goto("https://ibs.bankwest.com.au/CMWeb/Logout.aspx");
        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        await page.waitForSelector("table[id$=grdBalances] tbody tr");

        const accountSummaryRows = await page.$$("table[id$=grdBalances] tbody tr");
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval("td:nth-child(1)", (el: any) =>
                    el.textContent.trim(),
                ),
                accountNumber: await row.$eval("td:nth-child(2)", (el: any) =>
                    el.textContent.trim(),
                ),
                balance: parseFloat(
                    await row.$eval("td:nth-child(3)", (el: any) =>
                        el.textContent
                            .replace(/\s/g, "")
                            .replace("$", "")
                            .replace(",", ""),
                    ),
                ),
            });
        }

        return balances;
    }
}
