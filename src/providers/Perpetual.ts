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

        await page.goto("https://investor.myperpetual.com.au/");

        await page.waitForNavigation({ waitUntil: "networkidle0" });
        await page.waitForSelector("adv-login input", { visible: true });

        await page.type("input[name=username]", username);
        await page.type("input[name=password]", password);
        await page.click("button[type=submit]");

        await page.waitForNavigation({ waitUntil: "networkidle0" });
    }

    public async logout() {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        // Explicit logout not implemented

        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        // Perpetual uses Angular + Ivy in 'production mode' which means all the debugging
        // entry points for Angular are packed/tree-shaken away, which makes it hard/impossible
        // to get to the nice view-model objects behind all the custom components.

        // The page markup is gross and horribly inaccessible, so that's not a good route to go.

        // We've opted to intercept the XHR responses as they stream into the page instead.

        const balances = new Array<IAccountBalance>();
        const onResponse = async (response: any) => {
            const url = response.url();

            // Only care for 200-series responses
            if (!response.ok()) { return; }

            // Expecting URL like:
            // https://investor.myperpetual.com.au/mozart/api/adviser/current/accounts/AB123456789?includeDetails=true
            const looksLikeAnAccountResponse = /\/api\/adviser\/current\/accounts\/([^\/]*?)\?/.test(url);
            if (!looksLikeAnAccountResponse) { return; }

            const data = await response.json();
            balances.push({
                institution: providerName,
                accountName: data.mailingName || data.productName,
                accountNumber: data.accountNo,
                balance: data.details.accountBalance,
            });
        };

        page.on("response", onResponse);
        await page.goto("https://investor.myperpetual.com.au/mozart/investorweb/app/accounts/all-investments");
        await page.waitForNavigation({ waitUntil: "networkidle0" });
        page.off("response", onResponse);

        return balances;
    }
}
