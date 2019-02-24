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
    getBalances(
            relationship : FassInstitutionRelationship,
            executionContext : FassExecutionContext,
            retrieveSecretCallback : (key : string) => Promise<string>
        ) : Promise<Array<AccountBalance>>;
}
