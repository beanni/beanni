import {
  BankDataProviderInterface,
  AccountBalance
} from "../types";
import puppeteer = require("puppeteer");
import { FassExecutionContext } from "../core";

const providerName = "ANZ";

export class Anz implements BankDataProviderInterface {
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
    await page.goto("https://www.anz.com/INETBANK/bankmain.asp");
    const frames = await page.frames();
    var loginFrame = frames.filter(f => f.name() == "main")[0];
    await loginFrame.waitForSelector("#crn");
    await loginFrame.type("#crn", username);
    await loginFrame.type("#Password", password);
    await loginFrame.click("#SignonButton");
    await page.waitForSelector(".listViewAccountWrapperYourAccounts");
  }

  async logout() {
    if (this.browser == null) throw "Not logged in yet";
    if (this.page == null) throw "Not logged in yet";
    var page = this.page;

    await page.click(".button-logout");
    await this.browser.close();
  }

  async getBalances(): Promise<Array<AccountBalance>> {
    if (this.page == null) throw "Not logged in yet";
    var page = this.page;

    const balances = new Array<AccountBalance>();

    await page.waitForSelector(
      ".listViewAccountWrapperYourAccounts .accountNameSection"
    );

    var accountSummaryRows = await page.$$(
      ".listViewAccountWrapperYourAccounts"
    );
    for (const row of accountSummaryRows) {
      if ((await row.$(".accountNameSection")) === null) continue;

      balances.push({
        institution: providerName,
        accountName: await row.$eval(".accountNameSection", (el: any) =>
          el.textContent.trim()
        ),
        accountNumber: await row.$eval(".accountNoSection", (el: any) =>
          el.textContent.trim()
        ),
        balance: parseFloat(
          await row.$eval(".currentBalTD", (el: any) =>
            el.textContent
              .replace("Current balance", "")
              .replace(/\s/g, "")
              .replace("$", "")
              .replace(",", "")
          )
        )
      });
    }

    return balances;
  }
}
