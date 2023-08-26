import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class Bankwest implements IBankDataProviderInterface {
  public institution = "Bankwest";
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
      await page.goto("https://www.bankwest.com.au/business/login");

      await page.type("#customerPan", username);
      await page.type("#customerPassword", password);
      await page.click("#customerSubmit");

      await page.waitForSelector('[id$="lblWelcomeMessage"]');
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

    await page.goto("https://ibs.bankwest.com.au/CMWeb/Logout.aspx");
    await this.browser.close();
  }

  public async getBalances(): Promise<IAccountBalance[]> {
    if (this.page == null) {
      throw new Error("Not logged in yet");
    }
    const page = this.page;

    const balances = new Array<IAccountBalance>();

    await page.waitForSelector("table[id$=grdBalances] tbody tr");

    const accountSummaryRows = await page.$$("table[id$=grdBalances] tbody tr");
    for (const row of accountSummaryRows) {
      const accountName = await row.$eval("td:nth-child(1)", (el) =>
        (el.textContent || "").trim()
      );
      balances.push({
        institution: this.institution,
        accountName: accountName,
        accountNumber: await row.$eval("td:nth-child(2)", (el) =>
          (el.textContent || "").trim()
        ),
        balance: parseFloat(
          await row.$eval("td:nth-child(3)", (el) =>
            (el.textContent || "")
              .replace(/\s/g, "")
              .replace("$", "")
              .replace(",", "")
          )
        ),
        valueType: ProviderHelpers.guessValueTypeFromAccountName(accountName),
      });
    }

    return balances;
  }
}
