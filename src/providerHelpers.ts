import { ValueType } from "./types";

export class ProviderHelpers {
    public static guessValueTypeFromAccountName(
        accountName: string
    ): ValueType {
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
}
