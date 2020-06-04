import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

const providerName = "Perpetual";

export class Perpetual implements IBankDataProviderInterface {
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ) {
        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        const page = this.page = await this.browser.newPage();

        await page.goto("https://www.perpetual.com.au/loginsecure");
        const loginPageTitle = await page.title();
        if (loginPageTitle.includes("OpenAM")) {
            await page.waitForSelector("#IDToken1");
            await page.type("#IDToken1[type=text]", username);
            await page.type("#IDToken2[type=password]", password);
        } else {
            await page.waitForSelector("#onlineIDTextBox");
            await page.type("#onlineIDTextBox", username);
            await page.type("#passwordTextBox", password);
        }
        await page.click("input[type=submit][value=Login]");
    }

    public async logout() {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.goto("https://secure.perpetual.com.au/LogoutCancelSession.aspx");
        await page.waitForSelector("input[type=submit][value=Login]");

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        await page.waitForSelector("#accountSummaryTbl .total");

        const accountSummaryRows = await page.$$("#accountSummaryTbl > tbody > tr");
        for (const row of accountSummaryRows) {
            balances.push({
                institution: providerName,
                accountName: await row.$eval(".clientname", (el: any) => el.textContent.trim()),
                accountNumber: await row.$eval(".accountnumber", (el: any) => el.textContent.trim()),
                balance: parseFloat(
                    await row.$eval(
                        ".accountvalue",
                        (el: any) => el.textContent.trim().replace("$", "").replace(",", ""),
                    ),
                ),
            });
        }

        return balances;
    }
}
