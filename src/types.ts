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
  "Property Mortgage" = 300,
  "Property Equity" = 320,
  "Investment Funds" = 500,
  "Loan Offset" = 600,
  "Cash Savings" = 750,
  Cash = 1000,
  "Stored Value Cards" = 1250,
  "Consumer Debt" = 2000,
  Unknown = 10000,
}

export interface IBankDataProviderInterface {
  institution: string;

  login(
    retrieveSecretCallback: (key: string) => Promise<string>,
    config: unknown
  ): Promise<void>;

  logout(): Promise<void>;

  getBalances(): Promise<IAccountBalance[]>;
}

export interface IBankDataDocumentProviderInterface {
  getDocuments(statementFolderPath: string): Promise<void>;
}

export interface IBankDataHistoricalBalancesProviderInterface {
  getHistoricalBalances(
    knownDates: Date[]
  ): Promise<IHistoricalAccountBalance[]>;
}

export interface ICalculatedProviderInterface {
  getCalculatedBalances(
    otherBalances: IAccountBalance[]
  ): Promise<IAccountBalance[]>;
}

export interface ISecretStore {
  storeSecret(key: string, secret: string): Promise<void>;
  retrieveSecret(key: string): Promise<string>;
}
