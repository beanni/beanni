import { Router } from "express";
import _ from "lodash";
import { DataStore } from "../../dataStore";
import { IHistoricalAccountBalance } from "../../types";
const router = Router();

/* GET home page. */
router.get("/", async (_req, res, next) => {
    const dataStore = new DataStore();
    try {
        await dataStore.open();

        const allBalances = await dataStore.getAllBalances();

        const performanceByPeriods = calculatePerformanceByPeriods(allBalances);

        interface displayBalance extends IHistoricalAccountBalance {
            label: string;
        }
        const balanceData: displayBalance[] = allBalances
            .map(r => {
                const bd = <displayBalance>r;
                bd.label = `${bd.institution} ${bd.accountNumber} ${bd.accountName}`
                return bd;
            });
        const dates = _(balanceData)
            .map(r => r.date)
            .uniq()
            .value();
        const balanceHistoryChartData = {
            labels: dates,
            datasets: _(balanceData)
                .groupBy((r) => r.label)
                .map((_value, key) => ({
                    label: key,
                    data: _(dates)
                        .map((d) => {
                            const dataPoint = _(balanceData).find((bd) => bd.label === key && bd.date === d);
                            return dataPoint?.balance;
                        })
                        .value(),
                }))
                .value(),
        };

        res.render("index", {
            netWorth: await dataStore.getNetWorth(),
            performanceByPeriods,
            balanceHistoryChartData,
        });
    } catch (err) {
        next(err);
    } finally {
        await dataStore.close();
    }
});

function calculatePerformanceByPeriods(allBalances: IHistoricalAccountBalance[]) {
    const dates = _(allBalances)
        .map(r => r.date)
        .uniq()
        .value();
    const minDateRaw = _(dates).min();
    const maxDateRaw = _(dates).max();
    if (minDateRaw == null || maxDateRaw == null) { return null; }
    const minDate = new Date(new Date(minDateRaw).toISOString().substring(0, 10) + ' 00:00');
    const maxDate = new Date(new Date(maxDateRaw).toISOString().substring(0, 10) + ' 00:00');

    const periods = _(_.range(minDate.getFullYear(), maxDate.getFullYear() + 1))
        .map(year => {
            const quarters = [
                {
                    quarter: "Q1",
                    start: new Date(year, 1-1, 1),
                    end: new Date(year, 3-1, 31),
                },
                {
                    quarter: "Q2",
                    start: new Date(year, 4-1, 1),
                    end: new Date(year, 6-1, 30)
                },
                {
                    quarter: "Q3",
                    start: new Date(year, 7-1, 1),
                    end: new Date(year, 9-1, 30)
                },
                {
                    quarter: "Q4",
                    start: new Date(year, 10-1, 1),
                    end: new Date(year, 12-1, 31)
                }
            ];
            return quarters.map(q => {
                return {
                    year,
                    quarter: q.quarter,
                    start: q.start,
                    end: q.end,
                    incompletePeriod: (q.start < minDate) || (q.end > maxDate)
                }
            });
        })
        .flatten()
        .value();

    const singleTrailingIncompletePeriod = _(periods)
        .dropWhile(p => p.incompletePeriod)
        .dropWhile(p => !p.incompletePeriod)
        .take(1)
        .value();

    const validPeriods = _(periods)
        .dropWhile(p => p.incompletePeriod)
        .takeWhile(p => !p.incompletePeriod)
        .concat(singleTrailingIncompletePeriod)
        .value();

    const balanceAtDate = function(asAtDate: Date, bufferDays: number) : number {
        asAtDate = new Date(asAtDate);
        asAtDate.setDate(asAtDate.getDate() + bufferDays);
        return _(allBalances)
            .filter(b => new Date(b.date) < asAtDate)
            .groupBy(b => b.institution + b.accountNumber)
            .map(v => _(v).maxBy(d => d.date)?.balance)
            .sum();
    };

    const periodsWithMovements = _(validPeriods)
        .map(p => ({
            year: p.year,
            quarter: p.quarter,
            startingBalance: balanceAtDate(p.start, 1),
            endingBalance: balanceAtDate(p.end, 2),
            incompletePeriod: p.incompletePeriod,
        }))
        .value();

    return {
        years: _(periodsWithMovements)
            .groupBy(p => p.year)
            .map((value, key) => {
                const yearStartingBalance = balanceAtDate(new Date(`${key}-01-01 00:00`), 1);
                const yearEndingBalance = balanceAtDate(new Date(`${key}-12-31 00:00`), 1);
                return {
                    year: key,
                    performancePercentage: (yearEndingBalance / yearStartingBalance) - 1,
                    performanceAbsolute: yearEndingBalance - yearStartingBalance,
                    quarters: value.map(p => ({
                        quarter: p.quarter,
                        performancePercentage: (p.endingBalance / p.startingBalance) - 1,
                        performanceAbsolute: (p.endingBalance - p.startingBalance),
                        incompletePeriod: p.incompletePeriod,
                    })),
                };
            })
            .value(),
    };
}

export default router;
