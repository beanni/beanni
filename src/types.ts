import { FassExecutionContext } from "./core";

export interface FassInstitutionRelationship {
    name: string;
    provider: string;
}

export interface AccountBalance {
    accountNumber: string;
    accountName: string;
    institution: string;
    balance: number;
}

export interface BankDataProviderInterface {
    login(
        retrieveSecretCallback : (key : string) => Promise<string>
    ) : Promise<void>;

    logout() : Promise<void>;

    getBalances() : Promise<Array<AccountBalance>>;
}
