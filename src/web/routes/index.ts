import { Router } from "express";
import _ from "lodash";
import { DataStore } from "../../dataStore";
import { IHistoricalAccountBalance } from "../../types";
const router = Router();

/* GET home page. */
router.get("/", async (req, res) => {
    const dataStore = new DataStore();
    try {
        await dataStore.open();

        interface displayBalance extends IHistoricalAccountBalance {
            label: string;
        }

        const balanceData: displayBalance[] = (await dataStore.getAllBalances())
            .map(r => {
                const bd = <displayBalance>r;
                bd.label = `${bd.institution} ${bd.accountNumber} ${bd.accountName}`
                return bd;
            });
        const dates = _(balanceData)
            .groupBy((r) => r.date)
            .keys()
            .value();

        const balanceHistoryChartData = {
            labels: dates,
            datasets: _(balanceData)
                .groupBy((r) => r.label)
                .map((value, key) => ({
                    label: key,
                    data: _(dates)
                        .map((d) => {
                            const dataPoint = _(balanceData).find((bd) => bd.label === key && bd.date.toString() === d);
                            return dataPoint == null ? null : dataPoint.balance;
                        })
                        .value(),
                }))
                .value(),
        };

        res.render("index", {
            netWorth: await dataStore.getNetWorth(),
            balanceHistoryChartData,
        });
    } finally {
        await dataStore.close();
    }
});

export default router;
