import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { IAccountBalance, IHistoricalAccountBalance, ValueType } from "./types";

const DATA_FILE_NAME = "./beanni.db";

export class DataStore {
  private database?: Database;

  public async open(): Promise<void> {
    this.database = await open({
      filename: DATA_FILE_NAME,
      driver: sqlite3.Database,
    });
    await this.database.migrate({
      migrationsPath: __dirname + "/../src/migrations",
    });
  }

  public async addBalance(balance: IAccountBalance): Promise<void> {
    if (this.database == null) {
      throw new Error("Database not open yet");
    }
    await this.database.run(
      `INSERT INTO Balances
                (accountNumber, accountName, institution, balance, valueType)
            VALUES
                ($accountNumber, $accountName, $institution, $balance, $valueType);`,
      {
        $accountNumber: balance.accountNumber,
        $accountName: balance.accountName,
        $institution: balance.institution,
        $balance: Math.floor(balance.balance * 100),
        $valueType: balance.valueType,
      }
    );
  }

  public async addHistoricalBalance(
    balance: IHistoricalAccountBalance
  ): Promise<void> {
    if (this.database == null) {
      throw new Error("Database not open yet");
    }
    await this.database.run(
      `INSERT INTO Balances
                (accountNumber, accountName, institution, balance, valueType, timestamp)
            VALUES
                ($accountNumber, $accountName, $institution, $balance, $valueType, $date);`,
      {
        $accountNumber: balance.accountNumber,
        $accountName: balance.accountName,
        $institution: balance.institution,
        $balance: Math.floor(balance.balance * 100),
        $valueType: balance.valueType,
        $date: new Date(balance.date).toISOString().substring(0, 10),
      }
    );
  }

  public async getAllBalances(
    institution: string | null = null
  ): Promise<IHistoricalAccountBalance[]> {
    if (this.database == null) {
      throw new Error("Database not open yet");
    }
    const result = await this.database.all<IHistoricalAccountBalance[]>(
      `SELECT
                date(max(b.timestamp)) AS 'date',
                b.institution,
                b.accountNumber,
                b1.accountName,
                b1.valueType,
                b.balance
            FROM Balances b
            INNER JOIN (
                SELECT
                    institution,
                    accountNumber,
                    accountName,
                    valueType,
                    max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.institution = b1.institution AND b.accountNumber = b1.accountNumber
            WHERE ($institution is null OR b.institution = $institution)
            GROUP BY b.institution, b.accountNumber, date(b.timestamp)
            ORDER BY b1.valueType, date(b.timestamp), b.institution, b1.accountName`,
      {
        $institution: institution,
      }
    );
    result.forEach((r) => {
      r.balance = r.balance / 100;
      r.valueType = r.valueType ?? ValueType.Unknown;
    });
    return result;
  }

  public async getNetWealth(): Promise<number> {
    if (this.database == null) {
      throw new Error("Database not open yet");
    }
    const result = await this.database.get<{ result: number }>(
      `SELECT SUM(b.Balance) AS result
            FROM Balances b
            INNER JOIN (
                SELECT id, max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.id = b1.id ORDER BY institution, accountNumber`
    );
    return (result?.result ?? 0) / 100;
  }

  public async close(): Promise<void> {
    if (this.database == null) {
      throw new Error("Unexpected flow; closing before opening");
    }
    await this.database.close();
  }
}
