import { parseExpression } from 'cron-parser'

/**
 * Проверяет, имеет ли cron выражение фиксированный интервал
 * @param cronPattern - cron выражение
 * @returns true, если интервал фиксированный
 */
export function hasFixedInterval(cronPattern: string): boolean {
    try {
        const interval = parseExpression(cronPattern)

        // Получаем несколько следующих дат
        const dates = interval.iterate(3)

        if (dates.length < 3) return false

        // Проверяем, одинаковые ли интервалы между датами
        const interval1 = dates[1]!.getTime() - dates[0]!.getTime()
        const interval2 = dates[2]!.getTime() - dates[1]!.getTime()

        return interval1 === interval2
    } catch (error) {
        return false
    }
}

/**
 * Получает фиксированный интервал в миллисекундах для регулярных cron выражений
 * @param cronPattern - cron выражение
 * @returns фиксированный интервал в миллисекундах или null, если интервал не фиксированный
 */
export function getFixedInterval(cronPattern: string): number {
    if (!hasFixedInterval(cronPattern)) {
        throw new Error(`Cron pattern ${cronPattern} has no fixed interval`)
    }

    try {
        const interval = parseExpression(cronPattern)
        const dates = interval.iterate(2)

        return dates[1]!.getTime() - dates[0]!.getTime()
    } catch (error) {
        throw new Error(`Cron pattern ${cronPattern} has no fixed interval`)
    }
}
