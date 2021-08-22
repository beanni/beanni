import _ from "lodash";
import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataHistoricalBalancesProviderInterface, IBankDataProviderInterface, IHistoricalAccountBalance, ValueType } from "../types";

export class Asgard implements IBankDataProviderInterface, IBankDataHistoricalBalancesProviderInterface {
    public institution = "Asgard";
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

    public async logout() : Promise<void> {
        if (this.browser == null || this.page == null) { return; }
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

        await page.goto("https://www.investoronline.info/iol/home.do");
        this.debugLog("getBalances", 1);

        await page.waitForSelector("b");
        this.debugLog("getBalances", 1);

        const tables = await page.$x('//b[contains(text(), "Account type")]/ancestor::table[tbody/tr/td/b]');
        const table = (tables)[0];
        const rows = await table.$$("tr:not([bgColor])");
        for (const row of rows) {
            const cells = await row.$$("td");
            if (cells.length !== 3) { continue; }

            const cellText = await Promise.all(cells.map(async (c) => {
                return (await c.evaluate(node => node.textContent)).trim();
            }));

            if (cellText[0] === "TOTAL") { continue; }
            if (cellText[1] === "") { continue; }

            balances.push({
                institution: this.institution,
                accountName: cellText[0],
                accountNumber: cellText[1],
                balance: parseFloat(cellText[2].trim().replace("$", "").replace(",", "")),
                valueType: ValueType.Superannuation,
            });
        }

        return balances;
    }

    public async getHistoricalBalances(knownDates: Date[]): Promise<IHistoricalAccountBalance[]> {
        if (this.page == null) {
            throw new Error("Not logged in yet");
        }
        const page = this.page;

        const formattedDate = (d: Date) => d.toISOString().substring(0, 10);

        knownDates = _(knownDates)
            .sortedUniqBy(formattedDate)
            .value();
        const datesToLookup = new Array<Date>();

        // Find gaps in the existing date series
        if (knownDates.length > 0) {
            const earliestDate = knownDates[0];
            const latestDate = knownDates[knownDates.length-1];
            const fullDateSeries = new Array<Date>();
            for (let cursor = new Date(earliestDate); cursor < latestDate; cursor.setDate(cursor.getDate() + 1)) {
                fullDateSeries.push(new Date(cursor));
            }
            _(fullDateSeries)
                .differenceBy(knownDates, formattedDate)
                .sortedUniqBy(formattedDate)
                .forEach(d => datesToLookup.push(d));
        }
        console.log(`[${this.institution}] There are ${datesToLookup.length} historical data points to attempt to get`);

        const maxHistoricalBatchSize = 30;
        if (datesToLookup.length > maxHistoricalBatchSize) {
            console.log(`[${this.institution}] Limiting to ${maxHistoricalBatchSize} data points in this batch`);
            datesToLookup.splice(maxHistoricalBatchSize);
        }

        const balances = new Array<IHistoricalAccountBalance>();

        await page.goto("https://www.investoronline.info/iol/portfoliovaluation.do");

        for await (const dateToLookup of datesToLookup) {
            console.log(`[${this.institution}] Looking up ${dateToLookup.toISOString().substring(0, 10)}`);

            const dmyFormat = `${dateToLookup.getDate()}/${dateToLookup.getMonth()+1}/${dateToLookup.getFullYear()}`;

            await page.focus('form[name=PortfolioValuationForm] input[name=clientEnquiryValuationDate]');
            await page.$eval('form[name=PortfolioValuationForm] input[name=clientEnquiryValuationDate]', el => (<HTMLInputElement>el).value = '');
            await page.type('form[name=PortfolioValuationForm] input[name=clientEnquiryValuationDate]', dmyFormat);
            await page.keyboard.press("Tab");
            await page.click('form[name=PortfolioValuationForm] input[type=submit]');

            const accountName = await this.getTextContentByXPath("//form[@name='PortfolioValuationForm']//table/tbody/tr/td[contains(., 'Account Name')]/following-sibling::td");
            const accountNumber = await this.getTextContentByXPath("//form[@name='PortfolioValuationForm']//table/tbody/tr/td[contains(., 'Account Number')]/following-sibling::td");
            const accountValue = await this.getTextContentByXPath("//form[@name='PortfolioValuationForm']//table/tbody/tr/td[contains(., 'Account Value')]/following-sibling::td");
            const balance = parseFloat(accountValue.trim().replace("$", "").replace(",", ""));

            balances.push({
                institution: this.institution,
                accountName: accountName,
                accountNumber: accountNumber,
                balance: balance,
                date: new Date(dateToLookup),
                valueType: ValueType.Superannuation,
            });

            // These are probably intensive calculations server-side, so don't smash them too hard
            await page.waitForTimeout(5000);
        }

        return balances;
    }

    private async getTextContentByXPath(xpath: string): Promise<string> {
        let text;
        try
        {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const page = this.page!;
            await page.waitForXPath(xpath);
            const elements = await page.$x(xpath);
            text = await page.evaluate(el => el.textContent, elements[0]);
            if (text === undefined) throw "textContent was undefined";
        }
        catch (err) {
            if (this.executionContext.debug) {
                console.log(`[${this.institution}] Failed to read ${xpath}`);
                console.error(err);
                throw err;
            }
        }
        return text;
    }

    private debugLog(stage: string, position: number) {
        if (this.executionContext.debug) {
            console.log("%s: %s", stage, position.toString());
        }
    }
}
