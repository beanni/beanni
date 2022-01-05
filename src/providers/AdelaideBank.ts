import _ from "lodash";
import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface, ValueType } from "../types";

export class AdelaideBank implements IBankDataProviderInterface {
    public institution = "Adelaide Bank";
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

        await page.goto("https://inetbnkp.adelaidebank.com.au/");
        await page.waitForSelector(".form-group[data-testid='txtUsername']", { visible: true });
        this.debugLog("login", 1);

        await page.type(".form-group[data-testid='txtUsername'] input", username);
        await page.type(".form-group[data-testid='txtPassword'] input[role=textbox]", password, { delay: 100 });
        this.debugLog("login", 2);

        await page.focus("input[type=submit][value='Sign in']");
        await page.click("input[type=submit][value='Sign in']");
        this.debugLog("login", 3);

        await page.waitForSelector("a.btn-sign-out");
        this.debugLog("login", 4);
    }

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.click("a.btn-sign-out");
        this.debugLog("logout", 1);

        await page.waitForNetworkIdle();

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        this.debugLog("getBalances", 0);

        await page.waitForSelector(".portfolio table td.account");
        this.debugLog("getBalances", 1);

        const rows = await page.$$(".portfolio table tbody tr");
        for (const row of rows) {
            const accountName = await row.$eval(".account-name", el => (el.textContent || '').trim());
            const accountNumber = await row.$eval(".account-number", el => (el.textContent || '').trim());

            const balance =
                await row.$eval(
                    ".current-balance .amount-wrapper",
                    el => {
                        const balanceText = el.querySelector(".amount")?.textContent?.trim() || '0';
                        let balanceValue = parseFloat(balanceText.replace(/,/g, ""))
                        if (el.classList.contains('negative')) {
                            balanceValue *= -1;
                        }
                        return balanceValue;
                    }
                );

            const rowClassName = (await row.evaluate(r => r.className)) || '';
            const valueType =
                (rowClassName.indexOf('account-category-loan') > -1) ? ValueType["Property Mortgage"] :
                ProviderHelpers.guessValueTypeFromAccountName(accountName);

            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: accountNumber,
                balance: balance,
                valueType: valueType,
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
