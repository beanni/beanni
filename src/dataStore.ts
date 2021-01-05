import sqlite, { Database } from "sqlite";
import { IAccountBalance, IHistoricalAccountBalance } from "./types";

const DATA_FILE_NAME = "./beanni.db";

export class DataStore {
    private database?: Database;

    public async open() : Promise<void> {
        this.database = await sqlite.open(DATA_FILE_NAME);
        await this.database.migrate({ migrationsPath: __dirname + "/../src/migrations" });
    }

    public async addBalance(balance: IAccountBalance) : Promise<void> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        await this.database.run(
            `INSERT INTO Balances
                (accountNumber, accountName, institution, balance)
            VALUES
                ($accountNumber, $accountName, $institution, $balance);`,
            {
                $accountNumber: balance.accountNumber,
                $accountName: balance.accountName,
                $institution: balance.institution,
                $balance: Math.floor(balance.balance * 100),
            },
        );
    }

    public async addHistoricalBalance(balance: IHistoricalAccountBalance) : Promise<void> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        await this.database.run(
            `INSERT INTO Balances
                (accountNumber, accountName, institution, balance, timestamp)
            VALUES
                ($accountNumber, $accountName, $institution, $balance, $date);`,
            {
                $accountNumber: balance.accountNumber,
                $accountName: balance.accountName,
                $institution: balance.institution,
                $balance: Math.floor(balance.balance * 100),
                $date: balance.date,
            },
        );
    }

    public async getAllBalances(institution : string | null = null): Promise<IHistoricalAccountBalance[]> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        const result = await this.database.all<IHistoricalAccountBalance>(
            `SELECT
                date(b.timestamp) AS 'date',
                b.institution,
                b.accountNumber,
                b1.accountName,
                b.balance
            FROM Balances b
            INNER JOIN (
                SELECT institution, accountNumber, accountName, max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.institution = b1.institution AND b.accountNumber = b1.accountNumber
            WHERE ($institution is null OR b.institution = $institution)
            GROUP BY b.institution, b.accountNumber, date(b.timestamp)
            ORDER BY date(b.timestamp), b.institution, b1.accountName`,
            {
                $institution: institution,
            }
        );
        result.forEach((r) => { r.balance = r.balance / 100; });
        return result;
    }

    public async getNetWorth(): Promise<number> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        const result = await this.database.get<{ result : number }>(
            `SELECT SUM(b.Balance) AS result
            FROM Balances b
            INNER JOIN (
                SELECT id, max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.id = b1.id ORDER BY institution, accountNumber`,
        );
        return result.result / 100;
    }

    public async close() : Promise<void> {
        if (this.database == null) {
            throw new Error("Unexpected flow; closing before opening");
        }
        await this.database.close();
    }
}
