import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

const providerName = "Asgard";

export class Asgard implements IBankDataProviderInterface {
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

        await page.goto("https://www.investoronline.info/iol/iollogon/logon.jsp");
        await page.waitForSelector("input[type=text]");
        this.debugLog("login", 1);

        await page.type("input[type=text]", username);
        await page.type("input[type=password]", password);
        this.debugLog("login", 2);

        await page.click("input[type=submit][value=Login]");
        this.debugLog("login", 3);

        await page.waitForSelector("#logoutButton");
        this.debugLog("login", 4);
    }

    public async logout() {
        if (this.browser == null) { throw new Error("Not logged in yet"); }
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.goto("https://www.investoronline.info/iol/iollogon/logout_transfer.jsp");
        this.debugLog("logout", 1);

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        this.debugLog("getBalances", 0);

        await page.click("#headerLogo img");
        this.debugLog("getBalances", 1);

        await page.waitForSelector("b");
        this.debugLog("getBalances", 1);

        const tables = await page.$x('//b[contains(text(), "Account type")]/ancestor::table[tbody/tr/td/b]');
        const table = (tables)[0];
        const rows = await table.$$("tr:not([bgColor])");
        for (const row of rows) {
            const cells = await row.$$("td");
            if (cells.length !== 3) { continue; }

            const cellText = await Promise.all(cells.map(async (c: any) => {
                const handle = await c.getProperty("textContent");
                const value = await handle.jsonValue();
                return value.trim();
            }));

            if (cellText[0] === "TOTAL") { continue; }
            if (cellText[1] === "") { continue; }

            balances.push({
                institution: providerName,
                accountName: cellText[0],
                accountNumber: cellText[1],
                balance: parseFloat(cellText[2].trim().replace("$", "").replace(",", "")),
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
