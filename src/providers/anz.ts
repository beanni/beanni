import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import {
    IAccountBalance,
    IBankDataProviderInterface,
} from "../types";

const providerName = "ANZ";

export class Anz implements IBankDataProviderInterface {
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
        await page.goto("https://www.anz.com/INETBANK/bankmain.asp");
        const frames = await page.frames();
        const loginFrame = frames.filter((f) => f.name() === "main")[0];
        await loginFrame.waitForSelector("#crn");
        await loginFrame.type("#crn", username);
        await loginFrame.type("#Password", password);
        await loginFrame.click("#SignonButton");
        await page.waitForSelector(".listViewAccountWrapperYourAccounts");
    }

    public async logout() {
        if (this.browser == null) { throw new Error("Not logged in yet"); }
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.click(".button-logout");
        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        await page.waitForSelector(
            ".listViewAccountWrapperYourAccounts .accountNameSection",
        );

        const accountSummaryRows = await page.$$(
            ".listViewAccountWrapperYourAccounts",
        );
        for (const row of accountSummaryRows) {
            if ((await row.$(".accountNameSection")) === null) { continue; }

            balances.push({
                institution: providerName,
                accountName: await row.$eval(".accountNameSection", (el: any) =>
                    el.textContent.trim(),
                ),
                accountNumber: await row.$eval(".accountNoSection", (el: any) =>
                    el.textContent.trim(),
                ),
                balance: parseFloat(
                    await row.$eval(".currentBalTD", (el: any) =>
                        el.textContent
                            .replace("Current balance", "")
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
