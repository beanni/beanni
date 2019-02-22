import sqlite, { Database } from 'sqlite';
import { AccountBalance } from './types';

const FASS_DATA_FILE_NAME = './beanie.db';

export class DataStore
{
    private database?: Database;

    async open()
    {
        this.database = await sqlite.open(FASS_DATA_FILE_NAME);
        await this.database.migrate({ migrationsPath: 'src/migrations' });
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
                $balance: balance.balance * 100
            }
        );
    }

    async close() {
        if (this.database == null) {
            throw 'Unexpected flow; closing before opening';
        }
        await this.database.close();
    }
}
