import { FassExecutionContext } from "./core";

export interface FassInstitutionRelationship {
    name: string;
    provider: string;
    username: string;
    password: string;
}

export interface AccountBalance {
    accountNumber: string;
    accountName: string;
    institution: string;
    balance: number;
}

export interface BankDataProviderInterface {
    getBalances(relationship : FassInstitutionRelationship, executionContext : FassExecutionContext) : Promise<Array<AccountBalance>>;
}
