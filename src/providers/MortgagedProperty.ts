import { IBeanniExecutionContext } from "../core";
import {
  IAccountBalance,
  IBankDataProviderInterface,
  ICalculatedProviderInterface,
  IInstitutionRelationship,
  ValueType,
} from "../types";

type MortgagedPropertyConfig = IInstitutionRelationship & {
  value: number;
  loan: {
    institution: string;
    accountNumber: string;
  };
};

export class MortgagedProperty
  implements IBankDataProviderInterface, ICalculatedProviderInterface
{
  public institution = "Mortgaged Property";
  public executionContext: IBeanniExecutionContext;

  config: MortgagedPropertyConfig | undefined;

  constructor(executionContext: IBeanniExecutionContext) {
    this.executionContext = executionContext;
  }

  public async login(
    _retrieveSecretCallback: (key: string) => Promise<string>,
    config: MortgagedPropertyConfig
  ): Promise<void> {
    this.config = config;
  }

  public async logout(): Promise<void> {
    return;
  }

  public async getBalances(): Promise<IAccountBalance[]> {
    return new Array<IAccountBalance>();
  }

  public async getCalculatedBalances(
    otherBalances: IAccountBalance[]
  ): Promise<IAccountBalance[]> {
    if (this.config == null) {
      throw new Error("Config missing");
    }

    const config = this.config;

    const loanBalance = otherBalances.find(
      (bal) =>
        bal.institution === config.loan.institution &&
        bal.accountNumber === config.loan.accountNumber
    );

    const balances = new Array<IAccountBalance>();

    if (loanBalance === undefined) {
      console.log(
        `[${
          config.provider
        }] Couldn't find loan balance in this fetch for ${JSON.stringify(
          config.loan
        )}. ` +
          "The balance needs to have been retrieved by another provider in this same fetch. " +
          "Execution order of providers matters. " +
          `Balances found: ${JSON.stringify(otherBalances)}`
      );
      return balances;
    }

    const mortgagedBalance = loanBalance.balance * -1;
    balances.push({
      institution: this.institution,
      accountName: config.name || this.institution,
      accountNumber: `Mortgaged ${config.name}`,
      balance: mortgagedBalance,
      valueType: ValueType["Property Mortgage"],
    });
    balances.push({
      institution: this.institution,
      accountName: config.name || this.institution,
      accountNumber: `Equity ${config.name}`,
      balance: config.value - mortgagedBalance,
      valueType: ValueType["Property Equity"],
    });

    return balances;
  }

  private debugLog(stage: string, position: number) {
    if (this.executionContext.debug) {
      console.log("%s: %s", stage, position.toString());
    }
  }
}
