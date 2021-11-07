import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class Bankwest implements IBankDataProviderInterface {
    public institution = "Bankwest";
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(retrieveSecretCallback: (key: string) => Promise<string>) : Promise<void> {
        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        const page = (this.page = await this.browser.newPage());

        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        try
        {
            await page.goto("https://ibs.bankwest.com.au/BWLogin/rib.aspx");

            await page.type('input[name="AuthUC$txtUserID"]', username);
            await page.type('input[type="password"]', password);
            await page.click("#AuthUC_btnLogin");

            await page.waitForSelector('[id$="lblWelcomeMessage"]');
        } catch (error) {
            const timeoutError = error as puppeteer.TimeoutError;
            if (timeoutError.name === "TimeoutError") {
                const filename = `${new Date().toISOString().substring(0,10)}-${new Date().getTime()}-screenshot.png`;
                console.log (`[${this.institution}] Screenshot saved as ${filename}`);
                await page.screenshot({ path: filename, fullPage: true });
            }
            throw error;
        }
    }

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
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
            const accountName = await row.$eval("td:nth-child(1)", el => (el.textContent || '').trim());
            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: await row.$eval("td:nth-child(2)", el => (el.textContent || '').trim()),
                balance: parseFloat(
                    await row.$eval("td:nth-child(3)", el =>
                        (el.textContent || '')
                            .replace(/\s/g, "")
                            .replace("$", "")
                            .replace(",", ""),
                    ),
                ),
                valueType: ProviderHelpers.guessValueTypeFromAccountName(accountName),
            });
        }

        return balances;
    }
}
