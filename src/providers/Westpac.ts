import fs = require("fs");
import puppeteer = require("puppeteer");
import request = require("request");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataDocumentProviderInterface, IBankDataProviderInterface, ValueType } from "../types";

export class Westpac implements IBankDataProviderInterface, IBankDataDocumentProviderInterface {
    public institution = "Westpac";
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
        await page.goto(
            "https://banking.westpac.com.au/wbc/banking/handler?fi=wbc&TAM_OP=login&segment=personal&logout=false",
        );
        await page.waitForSelector("#fakeusername");
        await page.type("#fakeusername", username);
        await page.type("#password", password);
        await page.click("#signin");
        await page.waitForSelector("#customer-actions");
    }

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.goto("https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=logout");
        await page.waitForSelector("#logout");

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        // The dasboard layout is user-selectable; force it to list view
        await page.goto("https://banking.westpac.com.au/secure/banking/accounts/getsummarystartpage?viewType=Summary");
        await page.waitForSelector(".accounts-summarylistwidget table");

        const accountSummaryRows = await page.$$(".accounts-summarylistwidget table > tbody > tr");
        for (const row of accountSummaryRows) {
            const accountName = await row.$eval(
                ".tf-account-detail a span",
                el => (el.textContent || '').trim()
            );
            const accountNumber = await row.$eval(
                ".tf-account-detail div > span",
                el => (<HTMLElement>el).innerText.split("\n")[1],
            );
            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: accountNumber,
                balance: parseFloat(
                    await row.$eval(
                        ".balance.current .balance",
                        el => (el.textContent || '').trim().replace("minus", "").replace("$", "").replace(",", ""),
                    ),
                ),
                valueType:
                    accountNumber.indexOf('xxxx') === 0 ? ValueType["Consumer Debt"]
                    : ProviderHelpers.guessValueTypeFromAccountName(accountName),
            });
        }

        return balances;
    }

    public async getDocuments(statementFolderPath: string): Promise<void> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        // Wait for all of the panels to load
        await page.goto("https://banking.westpac.com.au/secure/banking/account/statements");
        await page.waitForSelector(".widget.accounts-statementswidget");
        await page.waitForFunction(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            () => ko.dataFor(document.querySelector(".widget.accounts-statementswidget")).Accounts().length > 0,
        );

        // Pull the session-specific and well-known account identifiers
        const accountList = await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return ko.dataFor(document.querySelector(".widget.accounts-statementswidget")).Accounts().map((_) => ({
                AccountGlobalId: _.AccountGlobalId(),
                AccountNumber: _.AccountNumber(),
            }));
        });

        // Snapshot the cookies from the browser to our own jar
        const cookies = await page.cookies();
        const cookieJar = request.jar();
        for (const cookie of cookies) {
            cookieJar.setCookie(`${cookie.name}=${cookie.value}`, "https://banking.westpac.com.au/");
        }

        // For each account
        for (const account of accountList) {
            // For each of the last 7 years
            for (let yearsPast = 0; yearsPast < 7; yearsPast++) {
                // Download all the statements
                const dateRangeString = this.generateDateRangeString(yearsPast);
                const areMore = await this.downloadStatementsAndDetermineIfThereAreMore(
                    account, dateRangeString, cookieJar, statementFolderPath);
                if (!areMore) { break; }
            }
        }
    }

    private generateDateRangeString(yearsPast: number) {
        const end = new Date();
        end.setFullYear(end.getFullYear() - yearsPast);

        const start = new Date();
        start.setFullYear(start.getFullYear() - yearsPast - 1);

        const rangeText =
            `${start.getDate()}/${start.getMonth()}/${start.getFullYear()}-` +
            `${end.getDate()}/${end.getMonth()}/${end.getFullYear()}`;

        return rangeText;
    }

    private async downloadStatementsAndDetermineIfThereAreMore(
            account: {
                AccountNumber: string;
                AccountGlobalId: string;
            },
            dateRangeString: string,
            cookieJar: request.CookieJar,
            statementFolderPath: string,
        ): Promise<boolean> {
        const result = await new Promise<{
            totalRecords: number,
            statements: Array<{
                DateString: string;
                Id: string;
                PdfDocumentId: string;
                PdfLink: string;
            }>;
        }>((resolve) => {
            request.get({
                uri: "https://banking.westpac.com.au/secure/banking/accounts/getstatementlist",
                qs: {
                    pageNumber: 0,
                    pageSize: 50,
                    accountGlobalId: account.AccountGlobalId,
                    statementDateRange: dateRangeString,
                },
                jar: cookieJar,
                json: true,
            },
            (err, res, json) => {
                if (err !== null) {
                    throw err;
                } else {
                    resolve(json);
                }
            });
        });
        if (result.totalRecords === 0) {
            return false;
        }
        for (const statement of result.statements) {
            await this.downloadStatement(account, statement, cookieJar, statementFolderPath);
        }
        return true;
    }

    private async downloadStatement(
            account: {
                AccountNumber: string;
            },
            statement: {
                DateString: string;
                Id: string;
                PdfDocumentId: string;
                PdfLink: string;
            },
            cookieJar: request.CookieJar,
            statementFolderPath: string,
        ): Promise<void> {
        const filename =
            `${statement.DateString} Westpac ${account.AccountNumber} ` +
            `Statement ${statement.Id || statement.PdfDocumentId}.pdf`;
        const targetPath = statementFolderPath + `${filename}`;

        const exists = await new Promise<boolean>((resolve) => {
            fs.access(targetPath, fs.constants.F_OK, (err) => {
                resolve(err === null);
            });
        });
        if (exists) {
            console.log(`[Westpac] Skipping download; already on disk: ${filename}`);
            return;
        }

        await new Promise<void>((resolve) => {
            const file = fs.createWriteStream(targetPath);
            request
                .get({
                    uri: statement.PdfLink,
                    jar: cookieJar,
                })
                .on("response", (res) => {
                    res.on("close", () => {
                        file.close();
                        console.log(`[Westpac] Statement downloaded: ${filename}`);
                        resolve();
                    });
                })
                .pipe(file);
        });
    }
}
