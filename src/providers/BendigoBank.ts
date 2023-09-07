import puppeteer = require("puppeteer");
import { IBeanniExecutionContext } from "../core";
import { ProviderHelpers } from "../providerHelpers";
import { IAccountBalance, IBankDataProviderInterface } from "../types";

export class BendigoBank implements IBankDataProviderInterface {
  public institution = "Bendigo Bank";
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
      await page.goto("https://banking.bendigobank.com.au/");

      await page.waitForSelector("[data-bc-mapping='Username_AccessID']");
      await page.type("[data-bc-mapping='Username_AccessID']", username);
      await page.click("[data-bc-mapping='Username_Next']");

      await page.waitForSelector("[data-bc-mapping='Password_PasswordInput']");
      await page.type("[data-bc-mapping='Password_PasswordInput']", password, {
        delay: 200,
      });
      await page.focus("[data-bc-mapping='Password_Next']");
      await page.click("[data-bc-mapping='Password_Next']");

      await page.waitForSelector("[data-bc-mapping='Navigation_Item_logout']");
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
      await page.goto("https://banking.bendigobank.com.au/banking/sign_out");
      await page.waitForSelector("[data-bc-mapping='Logout_ReturnToLogin']");
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

    try {
      await page.goto("https://banking.bendigobank.com.au/banking/accounts");

      // Toggle away to the payments page, then come back, to force the app to reload accounts
      await page.click("[data-bc-mapping='Navigation_Item_move_money']");
      page.click("[data-bc-mapping='Navigation_Item_accounts']");

      // Catch the API call
      const apiResponse = await page.waitForResponse(
        "https://banking.bendigobank.com.au/banking/api/accounts"
      );
      const accountData = await apiResponse.json();

      for (const account of accountData.accounts) {
        const balance = {
          institution: this.institution,
          accountName: account.name,
          accountNumber: account.accountNumber,
          balance: account.availableBalance.value / 100,
          valueType: ProviderHelpers.guessValueTypeFromAccountName(
            account.name
          ),
        };

        if (account.classification === "home-loan") {
          balance.balance = account.currentBalance.value / 100;
        }

        balances.push(balance);
      }
    } catch (error) {
      await ProviderHelpers.logError(error, page, this.institution);
      throw error;
    }

    return balances;
  }
}
