import fs = require("fs");
import puppeteer = require("puppeteer");
import request = require("request");
import { IBeanniExecutionContext } from "../core";
import {
    IAccountBalance,
    IBankDataDocumentProviderInterface,
    IBankDataProviderInterface,
} from "../types";

const providerName = "ANZ";

export class Anz implements IBankDataProviderInterface, IBankDataDocumentProviderInterface {
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

    public async getDocuments(statementFolderPath: string): Promise<void> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        await page.waitForSelector('a[title="View statements"]');
        await page.waitFor(1000);
        await page.click('a[title="View statements"]');
        await page.waitForSelector('select[name="DCC_ACCOUNT_INDEX"] option');
        let accountSelector = await page.$$('select[name="DCC_ACCOUNT_INDEX"] option');

        for (let i = 0; i < accountSelector.length; i++) {
            if (i > 0) {
                await page.select('select[name="DCC_ACCOUNT_INDEX"]', i.toString());
                await page.waitFor(1000);
                await page.waitForSelector('select[name="DCC_ACCOUNT_INDEX"] option');
                accountSelector = await page.$$('select[name="DCC_ACCOUNT_INDEX"] option');
            }

            const prop = await (await accountSelector[i].getProperty("innerText")).jsonValue();
            const accountPrefix = prop.match(/\((\d{4})/);
            const accountSuffix = prop.match(/(\d{4})\)/);
            const accountNumber = accountPrefix.length > 1 && accountSuffix.length > 1
                ? `${accountPrefix[1]}xxxxxxxx${accountSuffix[1]}`
                : prop;

            let year = "";
            const statements = await page.$$(".monthYearDisplay, #statementTableRow a");

            for (const statement of statements) {
                if (await (await statement.getProperty("tagName")).jsonValue() === "DIV") {
                    year = await (await statement.getProperty("innerText")).jsonValue();
                    continue;
                }

                const statementUrl = await (await statement.getProperty("href")).jsonValue();
                const dayDiv = await statement.$$(".dateSectionDiv");
                const monthDiv = await statement.$$(".monthSectionDiv");

                const day = await (await dayDiv[0].getProperty("innerText")).jsonValue();
                const month = await (await monthDiv[0].getProperty("innerText")).jsonValue();
                const filename = `${year}-${month}-${day} ANZ ${accountNumber} Statement.pdf`;

                const targetPath = statementFolderPath + `${filename}`;

                const exists = await new Promise<boolean>((resolve, reject) => {
                    fs.access(targetPath, fs.constants.F_OK, (err) => {
                        resolve(err === null);
                    });
                });
                if (exists) {
                    console.log(`[Anz] Skipping download; already on disk: ${filename}`);
                    continue;
                }

                const cookie = await page.evaluate(() => document.cookie);
                await new Promise((resolve, reject) => {
                    const file = fs.createWriteStream(targetPath);
                    request
                        .get({
                            uri: statementUrl,
                            rejectUnauthorized: false,
                            headers: {
                                "Referer": page.url(),
                                "Cookie": cookie,
                                // tslint:disable-next-line:max-line-length
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36",
                            },
                        })
                        .on("response", (res) => {
                            res.on("close", () => {
                                file.close();
                                console.log(`[Anz] Statement downloaded: ${filename}`);
                                resolve();
                            });
                        })
                        .pipe(file);
                });
            }
        }
    }
}
