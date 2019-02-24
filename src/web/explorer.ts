import express from 'express';
import { DataStore } from '../dataStore';

export class Explorer
{
    private server = express()
    private dataStore: DataStore;

    port: number = 3000;

    constructor(dataStore: DataStore) {
        this.dataStore = dataStore;
    }

    async run(
        launchCallback: (url : string) => void
    )
    {
        await this.dataStore.open();

        // TODO: Call await this.dataStore.close(); somewhere

        this.server.get('/', async (req, res) => {
            var netWorth = await this.dataStore.getNetWorth();
            res.send(
                `<html>
                    <head>
                        <title>Beanni</title>
                    </head>
                    <body style="font-family: sans-serif;">
                        His name was Beanni! He's worth \$${netWorth} right now.
                    </body>
                </html>`
            );
        });

        var url = `http://localhost:${this.port}`;
        this.server.listen(
            this.port,
            () => { launchCallback(url); }
        );
    }
}
