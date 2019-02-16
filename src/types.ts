export interface BankDataProviderInterface {
    getBalance() : Promise<Number>;
}
