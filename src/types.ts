export interface IInstitutionRelationship {
    name: string;
    provider: string;
}

export interface IAccountBalance {
    accountNumber: string;
    accountName: string;
    institution: string;
    balance: number;
    valueType: ValueType;
}

export interface IHistoricalAccountBalance extends IAccountBalance {
    date: Date;
}

export enum ValueType {
    Superannuation = 100,
    Loan = 300,
    "Loan Offset" = 400,
    "Investment Funds" = 500,
    "Cash Savings" = 750,
    Cash = 1000,
    "Stored Value Cards" = 1250,
    "Consumer Debt" = 2000,
    Unknown = 10000,
}

export interface IBankDataProviderInterface {
    institution : string;

    login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ): Promise<void>;

    logout(): Promise<void>;

    getBalances(): Promise<IAccountBalance[]>;
}

export interface IBankDataDocumentProviderInterface {
    getDocuments(statementFolderPath: string): Promise<void>;
}

export interface IBankDataHistoricalBalancesProviderInterface {
    getHistoricalBalances(knownDates: Date[]): Promise<IHistoricalAccountBalance[]>;
}

export interface ISecretStore {
    storeSecret(key: string, secret: string): Promise<void>;
    retrieveSecret(key: string): Promise<string>;
}
