export interface IInstitutionRelationship {
    name: string;
    provider: string;
}

export interface IAccountBalance {
    accountNumber: string;
    accountName: string;
    institution: string;
    balance: number;
}

export interface IBankDataProviderInterface {
    login(
        retrieveSecretCallback: (key: string) => Promise<string>,
    ): Promise<void>;

    logout(): Promise<void>;

    getBalances(): Promise<IAccountBalance[]>;
}
