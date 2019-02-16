export interface FassAccount {
    name: string;
    provider: string;
    username: string;
    password: string;
}

export interface BankDataProviderInterface {
    getBalance(account : FassAccount) : Promise<Number | null>;
}
