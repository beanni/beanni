import sqlite, { Database } from 'sqlite';
import { AccountBalance } from './types';

const FASS_DATA_FILE_NAME = './beanni.db';

export class DataStore
{
    private database?: Database;

    async open()
    {
        this.database = await sqlite.open(FASS_DATA_FILE_NAME);
        await this.database.migrate({ migrationsPath: __dirname + '/../src/migrations' });
    }

    async addBalance(balance: AccountBalance) {
        if (this.database == null) {
            throw 'Database not open yet';
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
                $balance: Math.floor(balance.balance * 100)
            }
        );
    }

    async getAllBalances() : Promise<any> {
        if (this.database == null) {
            throw 'Database not open yet';
        }
        var result = await this.database.all<any>(
            `SELECT *, max(timestamp) FROM Balances GROUP BY institution, accountNumber`
        );
        result.forEach(r => { r.balance = r.balance / 100; })
        return result;
    }

    async getNetWorth() : Promise<number> {
        if (this.database == null) {
            throw 'Database not open yet';
        }
        var result = await this.database.get<any>(
            `SELECT SUM(b.Balance) AS result
            FROM Balances b
            INNER JOIN (
                SELECT id, max(timestamp)
                FROM Balances
                GROUP BY institution, accountNumber
            ) b1
            ON b.id = b1.id ORDER BY institution, accountNumber`
        );
        return (<number>result.result) / 100;
    }

    async close() {
        if (this.database == null) {
            throw 'Unexpected flow; closing before opening';
        }
        await this.database.close();
    }
}
