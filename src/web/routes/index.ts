import { Router } from "express";
import _ from "lodash";
import { DataStore } from "../../dataStore";
const router = Router();

/* GET home page. */
router.get("/", async (req, res, next) => {
    const dataStore = new DataStore();
    try {
        await dataStore.open();

        const colors = [
            "rgb(255, 99, 132)",
            "rgb(255, 159, 64)",
            "rgb(255, 205, 86)",
            "rgb(75, 192, 192)",
            "rgb(54, 162, 235)",
            "rgb(153, 102, 255)",
            "rgb(201, 203, 207)",
        ];
        let colorIndex = 0;

        const balanceData: any[] = await dataStore.getAllBalances();
        balanceData.forEach((bd) => {
            bd.label = `${bd.institution} ${bd.accountNumber} ${bd.accountName}`;
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
                            const dataPoint = _(balanceData).find((bd) => bd.label === key && bd.date === d);
                            return dataPoint == null ? null : dataPoint.balance;
                        })
                        .value(),
                    backgroundColor: colors[colorIndex++ % colors.length],
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
