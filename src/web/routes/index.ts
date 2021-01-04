import { Router } from "express";
import _ from "lodash";
import { DataStore } from "../../dataStore";
const router = Router();

/* GET home page. */
router.get("/", async (req, res, next) => {
    const dataStore = new DataStore();
    try {
        await dataStore.open();

        // https://learnui.design/tools/data-color-picker.html#palette
        const colors = [
            "#003f5c",
            "#2f4b7c",
            "#665191",
            "#a05195",
            "#d45087",
            "#f95d6a",
            "#ff7c43",
            "#ffa600",
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
