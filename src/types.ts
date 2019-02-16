export interface FassAccount {
    name: string;
    provider: string;
}

export interface BankDataProviderInterface {
    getBalance(account : FassAccount) : Promise<Number>;
}
