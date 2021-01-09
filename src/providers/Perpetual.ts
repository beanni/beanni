import _ from "lodash";
import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { IAccountBalance, IBankDataHistoricalBalancesProviderInterface, IBankDataProviderInterface, IHistoricalAccountBalance } from "../types";

export class Perpetual implements IBankDataProviderInterface, IBankDataHistoricalBalancesProviderInterface {
    public institution = "Perpetual";
    public executionContext: IBeanniExecutionContext;

    public browser: puppeteer.Browser | undefined;
    public page: puppeteer.Page | undefined;

    public constructor(executionContext: IBeanniExecutionContext) {
        this.executionContext = executionContext;
    }

    public async login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ): Promise<void> {
        const username = await retrieveSecretCallback("username");
        const password = await retrieveSecretCallback("password");

        this.browser = await puppeteer.launch({
            headless: !this.executionContext.debug,
        });
        const page = this.page = await this.browser.newPage();

        await page.goto("https://investor.myperpetual.com.au/");

        await page.waitForNavigation({ waitUntil: "networkidle0" });
        await page.waitForSelector("adv-login input", { visible: true });

        await page.type("input[name=username]", username);
        await page.type("input[name=password]", password);
        await page.click("button[type=submit]");

        await page.waitForNavigation({ waitUntil: "networkidle0" });
    }

    public async logout(): Promise<void> {
        if (this.browser == null || this.page == null) {
            return;
        }

        // Explicit logout not implemented

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) {
            throw new Error("Not logged in yet");
        }
        const page = this.page;

        // Perpetual uses Angular + Ivy in 'production mode' which means all the debugging
        // entry points for Angular are packed/tree-shaken away, which makes it hard/impossible
        // to get to the nice view-model objects behind all the custom components.

        // The page markup is gross and horribly inaccessible, so that's not a good route to go.

        // We've opted to intercept the XHR responses as they stream into the page instead.

        const balances = new Array<IAccountBalance>();
        const handleResponse = async (response: puppeteer.Response) => {
            const url = response.url();

            // Only care for 200-series responses
            if (!response.ok()) {
                return;
            }

            // Expecting a URL like:
            // https://investor.myperpetual.com.au/mozart/api/adviser/current/accounts/AB123456789?includeDetails=true
            const looksLikeAnAccountResponse = /\/api\/adviser\/current\/accounts\/([^/]*?)\?/.test(url);
            if (!looksLikeAnAccountResponse) {
                return;
            }

            const data = await response.json() as {
                mailingName: string;
                productName: string;
                accountNo: string;
                details: { accountBalance: number };
            };
            balances.push({
                institution: this.institution,
                accountName: data.mailingName || data.productName,
                accountNumber: data.accountNo,
                balance: data.details.accountBalance,
            });
        };
        const onResponse = (response: puppeteer.Response) => {
            handleResponse(response)
                .then(null, (reason) => {
                    throw reason;
                });
        };

        page.on("response", onResponse);
        await page.goto("https://investor.myperpetual.com.au/mozart/investorweb/app/accounts/all-investments");
        await page.waitForNavigation({ waitUntil: "networkidle0" });
        page.off("response", onResponse);

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
        console.log(`[Perpetual] There are ${datesToLookup.length} historical data points to attempt to get`);

        const maxHistoricalBatchSize = 30;
        if (datesToLookup.length > maxHistoricalBatchSize) {
            console.log(`[Perpetual] Limiting to ${maxHistoricalBatchSize} data points in this batch`);
            datesToLookup.splice(maxHistoricalBatchSize);
        }

        const balances = new Array<IHistoricalAccountBalance>();

        await page.goto("https://investor.myperpetual.com.au/mozart/investorweb/app/accounts/all-investments");
        await page.waitForNavigation({ waitUntil: "networkidle0" });
        await page.click('adv-investment-summary mat-expansion-panel mat-expansion-panel-header');

        const handleResponse = async (response: puppeteer.Response) => {
            const url = response.url();

            // Only care for 200-series responses
            if (!response.ok()) {
                return;
            }

            // Expecting a URL like:
            // https://investor.myperpetual.com.au/mozart/api/adviser/current/accounts/AB123456789/parcels?effectiveDate=2020-08-05
            const regex = new RegExp(/\/accounts\/(?<accountNumber>[\w\d]+?)\/parcels?/);
            const regexMatch = regex.exec(url);
            if (regexMatch == null) { return; }

            const accountNumber = regexMatch?.groups?.accountNumber;
            if (accountNumber == null) { return; }

            const effectiveDate = new URL(url).searchParams.get('effectiveDate');
            if (effectiveDate == null) { return; }

            const data = await response.json() as {
                certDetails: {
                    availUnits: number;
                    origPurchaseDate: Date;
                    origPurchasePrice: number;
                    sellPrice: number;
                }[];
            }[];

            const balance = _(data)
                .map(f => f.certDetails.reduce((acc, val) => acc + (val.availUnits * val.sellPrice), 0))
                .sum();

            balances.push({
                institution: this.institution,
                accountName: 'Historical Lookup',
                accountNumber: accountNumber,
                balance: balance,
                date: new Date(effectiveDate),
            });
        };
        const onResponse = (response: puppeteer.Response) => {
            handleResponse(response)
                .then(null, (reason) => {
                    throw reason;
                });
        };

        page.on("response", onResponse);
        for await (const dateToLookup of datesToLookup) {
            console.log(`[Perpetual] Looking up ${dateToLookup.toISOString().substring(0, 10)}`);

            const dmyFormat = `${dateToLookup.getDate()}/${dateToLookup.getMonth()+1}/${dateToLookup.getFullYear()}`;

            await page.click('adv-investment-summary mat-expansion-panel adv-as-at-date-select input');
            await page.$eval('adv-investment-summary mat-expansion-panel adv-as-at-date-select input', el => (<HTMLInputElement>el).value = '');
            await page.type('adv-investment-summary mat-expansion-panel adv-as-at-date-select input', dmyFormat);
            await page.keyboard.press("Tab");
            await page.waitForResponse(response => response.ok() && response.url().indexOf("/parcels?") > 0, { timeout: 20000 });

            // These are probably intensive calculations server-side, so don't smash them too hard
            await page.waitForTimeout(5000);
        }
        page.off("response", onResponse);

        return balances;
    }
}
