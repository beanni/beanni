import assert = require("assert");
import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import {
  IAccountBalance,
  IBankDataProviderInterface,
  ValueType,
} from "../types";
import { ProviderHelpers } from "../providerHelpers";

export class TelstraSuper implements IBankDataProviderInterface {
  public institution = "TelstraSuper";
  public executionContext: IBeanniExecutionContext;

  public browser: puppeteer.Browser | undefined;
  public page: puppeteer.Page | undefined;

  constructor(executionContext: IBeanniExecutionContext) {
    this.executionContext = executionContext;
  }

  public async login(
    retrieveSecretCallback: (key: string) => Promise<string>
  ): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: !this.executionContext.debug,
    });
    const page = (this.page = await this.browser.newPage());

    const username = await retrieveSecretCallback("username");
    const password = await retrieveSecretCallback("password");

    try {
      await page.goto("https://www.telstrasuper.com.au/login");
      await page.waitForSelector("input[type=text][name=MemberNumber]");
      this.debugLog("login", 1);

      await page.type("input[type=text][name=MemberNumber]", username);
      await page.type("input[type=password]", password);
      this.debugLog("login", 2);

      await page.click("form[action='/login'] button[type=submit]");
      this.debugLog("login", 3);

      await page.waitForSelector("main#main header h1");
      this.debugLog("login", 4);
    } catch (error) {
      await ProviderHelpers.logError(error, page, this.institution);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (this.browser == null || this.page == null) {
      return;
    }
    const page = this.page;

    try {
      await page.goto("https://www.telstrasuper.com.au/api/account/logout");
      this.debugLog("logout", 1);
    } catch (error) {
      await ProviderHelpers.logError(error, page, this.institution);
      throw error;
    }

    await this.browser.close();
  }

  public async getBalances(): Promise<IAccountBalance[]> {
    if (this.page == null) {
      throw new Error("Not logged in yet");
    }
    const page = this.page;

    const balances = new Array<IAccountBalance>();

    this.debugLog("getBalances", 0);

    try {
      await page.goto("https://www.telstrasuper.com.au/your-account");
      this.debugLog("getBalances", 1);

      await page.waitForSelector(
        ".bx-balance-breakdown table.js-chart-data-table tbody tr"
      );
      this.debugLog("getBalances", 2);

      const rows = await page.$$(
        ".bx-balance-breakdown table.js-chart-data-table tbody tr"
      );
      this.debugLog("getBalances", 3);
      for (const row of rows) {
        const cells = await row.$$("td");
        this.debugLog("getBalances", 4);

        const accountName = await cells[0].evaluate((el) => el.textContent);
        assert(accountName);
        const balanceText = await cells[1].evaluate((el) => el.textContent);
        assert(balanceText);
        const accountNumber = await cells[3].evaluate((el) => el.textContent);
        assert(accountNumber);

        const balance = parseFloat(balanceText);

        balances.push({
          institution: this.institution,
          accountName: accountName,
          accountNumber: accountNumber,
          balance: balance,
          valueType: ValueType.Superannuation,
        });
      }
    } catch (error) {
      await ProviderHelpers.logError(error, page, this.institution);
      throw error;
    }

    this.debugLog("getBalances", 5);
    return balances;
  }

  private debugLog(stage: string, position: number) {
    if (this.executionContext.debug) {
      console.log("%s: %s", stage, position.toString());
    }
  }
}
