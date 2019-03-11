import {
  BankDataProviderInterface,
  FassInstitutionRelationship,
  AccountBalance
} from "../types";
import puppeteer = require("puppeteer");
import { FassExecutionContext } from "../core";

const providerName = "AmericanExpress";

export class AmericanExpress implements BankDataProviderInterface {
  executionContext: FassExecutionContext;

  browser: puppeteer.Browser | undefined;
  page: puppeteer.Page | undefined;

  constructor(executionContext: FassExecutionContext) {
    this.executionContext = executionContext;
  }

  async login(retrieveSecretCallback: (key: string) => Promise<string>) {
    this.browser = await puppeteer.launch({
      headless: !this.executionContext.debug
    });
    var page = (this.page = await this.browser.newPage());

    const username = await retrieveSecretCallback("username");
    const password = await retrieveSecretCallback("password");
    await page.goto("https://www.americanexpress.com/australia/?inav=NavLogo");
    await page.waitForSelector("#login-user");
    await page.type("#login-user", username);
    await page.type("#login-password", password);
    await page.click("#login-submit");
    await page.waitForSelector(".summary-container");
  }

  async logout() {
    if (this.browser == null) throw "Not logged in yet";
    if (this.page == null) throw "Not logged in yet";
    var page = this.page;

    await page.click("#au_utility_login");
    await this.browser.close();
  }

  async getBalances(): Promise<Array<AccountBalance>> {
    if (this.page == null) throw "Not logged in yet";
    var page = this.page;

    const balances = new Array<AccountBalance>();

    await page.goto(
      "https://global.americanexpress.com/myca/intl/istatement/japa/v1/statement.do?BPIndex=0&method=displayStatement&inav=au_myca_pc_statement_yourcrd&Face=en_AU&sorted_index=0#/"
    );
    await page.waitForSelector(".statement-container");
    await page.waitForFunction(() => "angular" in window);
    await page.waitForFunction(
      'window.angular.element(document.getElementsByTagName("card-selector")) && window.angular.element(document.getElementsByTagName("card-selector")).scope()'
    );

    const selectedCard = <any>(
      await page.evaluate(
        'window.angular.element(document.getElementsByTagName("card-selector")).scope().selectedCard'
      )
    );
    const selectedCardBalance = await page.evaluate(
      'window.angular.element(document.getElementsByTagName("card-selector")).scope().totalBalance'
    );

    balances.push({
      institution: providerName,
      accountName: selectedCard.productId.cardProductDesc.trim(),
      accountNumber: selectedCard.obfuscatedAccountNumber,
      balance: -parseFloat(selectedCardBalance)
    });
    return balances;
  }
}
