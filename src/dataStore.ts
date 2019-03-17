import sqlite, { Database } from "sqlite";
import { IAccountBalance } from "./types";

const DATA_FILE_NAME = "./beanni.db";

export class DataStore {
    private database?: Database;

    public async open() {
        this.database = await sqlite.open(DATA_FILE_NAME);
        await this.database.migrate({ migrationsPath: __dirname + "/../src/migrations" });
    }

    public async addBalance(balance: IAccountBalance) {
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

    public async getAllBalances(): Promise<any> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        const result = await this.database.all<any>(
            `SELECT date(timestamp) AS 'date', institution, accountNumber, accountName, balance, max(timestamp)
            FROM Balances
            GROUP BY institution, accountNumber, date(timestamp)
            ORDER BY date(timestamp), institution, accountNumber`,
        );
        result.forEach((r) => { r.balance = r.balance / 100; });
        return result;
    }

    public async getNetWorth(): Promise<number> {
        if (this.database == null) {
            throw new Error("Database not open yet");
        }
        const result = await this.database.get<any>(
            `SELECT SUM(b.Balance) AS result
            FROM Balances b
            INNER JOIN (
                SELECT id, max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.id = b1.id ORDER BY institution, accountNumber`,
        );
        return ( result.result as number) / 100;
    }

    public async close() {
        if (this.database == null) {
            throw new Error("Unexpected flow; closing before opening");
        }
        await this.database.close();
    }
}
