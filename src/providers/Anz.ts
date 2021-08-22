import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class Anz implements IBankDataProviderInterface {
    public institution = "ANZ";
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(retrieveSecretCallback: (key: string) => Promise<string>): Promise<void> {
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

    public async logout(): Promise<void> {
        if (this.browser == null || this.page == null) { return; }
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

            const accountName = await row.$eval(".accountNameSection", el => (el.textContent || '').trim());
            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: await row.$eval(".accountNoSection", el => (el.textContent || '').trim()),
                balance: parseFloat(
                    await row.$eval(".currentBalTD", el =>
                        (el.textContent || '')
                            .replace("Current balance", "")
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
