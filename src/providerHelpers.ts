import { ValueType } from "./types";
import puppeteer = require("puppeteer");

export class ProviderHelpers {
  public static guessValueTypeFromAccountName(accountName: string): ValueType {
    const lowerAccountName = accountName.toLowerCase();

    if (lowerAccountName.indexOf("superannuation") > -1) {
      return ValueType.Superannuation;
    }

    if (lowerAccountName.indexOf("savings") > -1) {
      return ValueType["Cash Savings"];
    }

    if (lowerAccountName.indexOf("offset") > -1) {
      return ValueType["Loan Offset"];
    }

    if (lowerAccountName.indexOf("frequent flyer") > -1) {
      return ValueType["Consumer Debt"];
    }

    return ValueType.Cash;
  }

  public static async logError(
    error: unknown,
    page: puppeteer.Page,
    institution: string
  ): Promise<void> {
    const timeoutError = error as puppeteer.TimeoutError;
    if (timeoutError.name === "TimeoutError") {
      const filename = `${new Date()
        .toISOString()
        .substring(0, 10)}-${new Date().getTime()}-screenshot.png`;
      console.log(
        `[${institution}] Screenshot of ${page.url()} saved as ${filename}`
      );
      await page.screenshot({ path: filename, fullPage: true });
    }
  }
}
