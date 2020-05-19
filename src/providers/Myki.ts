import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

const providerName = "Myki";

export class Myki implements IBankDataProviderInterface {
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
        });
        const page = this.page = await this.browser.newPage();

        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");
        await page.goto("https://www.mymyki.com.au/NTSWebPortal/Login.aspx");
        await page.waitForSelector("input[name$=Username]");
        await page.type("input[name$=Username]", username);
        await page.type("input[name$=Password]", password);
        await page.click("input[type=submit][value=Login]");
    }

    public async logout() {
        if (this.browser == null) { throw new Error("Not logged in yet"); }
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.click('input[name="ctl00$uxHeader$uxLoginImg"]');

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        await page.waitForSelector("#tabs-1 table.acc-tab-table tr a");

        const accountSummaryRows = await page.$$("#tabs-1 table.acc-tab-table tr");
        for (const row of accountSummaryRows) {
            // Skip the header row which is all made up of <th> elements
            if ((await row.$$("td")).length === 0) { continue; }

            balances.push({
                institution: providerName,
                accountName: await row.$eval("td:nth-child(2)", (el: any) => el.textContent.trim()),
                accountNumber: await row.$eval("td a", (el: any) => el.textContent.trim()),
                balance: parseFloat(
                    await row.$eval(
                        "td:nth-child(3)",
                        (el: any) => el.textContent.trim().replace("$", "").replace(",", ""),
                    ),
                ),
            });
        }

        return balances;
    }
}
