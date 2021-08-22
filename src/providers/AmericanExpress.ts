import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import {
    IAccountBalance,
    IBankDataProviderInterface,
    ValueType,
} from "../types";

export class AmericanExpress implements IBankDataProviderInterface {
    public institution = "AmericanExpress";
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
        await page.goto("https://www.americanexpress.com/en-au/account/login");
        await page.waitForSelector("#eliloUserID");
        await page.type("#eliloUserID", username);
        await page.type("#eliloPassword", password);
        await page.click("#loginSubmit");
        await page.waitForSelector(".summary-container");
    }

    public async logout(): Promise<void> {
        if (this.browser == null || this.page == null) { return; }
        const page = this.page;

        await page.goto("https://www.americanexpress.com/en-au/account/logout");
        await this.browser.close();
    }

    public async getBalances(): Promise<IAccountBalance[]> {
        if (this.page == null) { throw new Error("Not logged in yet"); }
        const page = this.page;

        const balances = new Array<IAccountBalance>();

        await page.goto(
// eslint-disable-next-line max-len
            "https://global.americanexpress.com/myca/intl/istatement/japa/v1/statement.do?BPIndex=0&method=displayStatement&inav=au_myca_pc_statement_yourcrd&Face=en_AU&sorted_index=0#/",
        );
        await page.waitForSelector(".statement-container");
        await page.waitForFunction(() => "angular" in window);
        await page.waitForFunction(
// eslint-disable-next-line max-len
            'window.angular.element(document.getElementsByTagName("card-selector")) && window.angular.element(document.getElementsByTagName("card-selector")).scope()',
        );

        const selectedCard = await page.evaluate(
            'window.angular.element(document.getElementsByTagName("card-selector")).scope().selectedCard',
        ) as { productId : { cardProductDesc : string }, obfuscatedAccountNumber : string };
        const selectedCardBalance = await page.evaluate(
            'window.angular.element(document.getElementsByTagName("card-selector")).scope().totalBalance',
        ) as string;

        balances.push({
            institution: this.institution,
            accountName: selectedCard.productId.cardProductDesc.trim(),
            accountNumber: selectedCard.obfuscatedAccountNumber,
            balance: -parseFloat(selectedCardBalance),
            valueType: ValueType["Consumer Debt"],
        });
        return balances;
    }
}
