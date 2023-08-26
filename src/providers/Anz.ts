import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class Anz implements IBankDataProviderInterface {
  public institution = "ANZ";
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
      await page.goto("https://login.anz.com/internetbanking");
      await page.waitForSelector("#customerRegistrationNumber");
      await page.type("#customerRegistrationNumber", username);
      await page.type("#password", password);
      await page.click("button[data-test-id='log-in-btn']");
      await page.waitForSelector("#main-details-wrapper");
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

    await page.click("button[data-test-id='Button_Logout']");
    await this.browser.close();
  }

  public async getBalances(): Promise<IAccountBalance[]> {
    if (this.page == null) {
      throw new Error("Not logged in yet");
    }
    const page = this.page;

    const balances = new Array<IAccountBalance>();

    await page.waitForSelector("#main-div");

    const accountSummaryRows = await page.$$("#main-div > ul > li");
    for (const row of accountSummaryRows) {
      if ((await row.$("#card-name")) === null) {
        continue;
      }

      const accountName = await row.$eval("#card-name", (el) =>
        (el.textContent || "").trim()
      );
      balances.push({
        institution: this.institution,
        accountName: accountName,
        accountNumber: await row.$eval("#card-number", (el) =>
          (el.textContent || "").trim()
        ),
        balance: parseFloat(
          await row.$eval("#card-middle-amount > span", (el) =>
            (el.textContent || "")
              .replace("Current balance", "")
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
