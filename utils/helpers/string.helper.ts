/**
 * Маскирует строку, оставляя видимыми только указанное количество символов
 * 
 * @param str - Строка для маскировки
 * @param visibleChars - Количество символов, которые нужно оставить видимыми с начала
 * @param symmetric - Если true, оставляет такое же количество символов видимыми с конца
 * @param hideLength - Если true, скрывает реальное количество символов, показывая меньше звездочек
 * @returns Замаскированная строка
 * @throws {Error} Если str равен null или undefined
 * @throws {Error} Если visibleChars отрицательное число, NaN, Infinity или не целое число
 * 
 * @example
 * maskString('abcdefghijklmnop', 4, false, false) // 'abcd************'
 * maskString('abcdefghijklmnop', 4, true, false) // 'abcd********mnop'
 * maskString('abcdefghijklmnop', 4, false, true) // 'abcd***'
 * maskString('abc', 1, false, false) // 'a**'
 */
export function maskString(
    str: string,
    visibleChars: number,
    symmetric: boolean = false,
    hideLength: boolean = false
): string {
    // Валидация входных параметров
    if (str == null) {
        throw new Error('str cannot be null or undefined')
    }

    if (typeof str !== 'string') {
        throw new Error('str must be a string')
    }

    if (visibleChars < 0 || !Number.isFinite(visibleChars)) {
        throw new Error('visibleChars must be a non-negative finite number')
    }

    if (!Number.isInteger(visibleChars)) {
        throw new Error('visibleChars must be an integer')
    }

    // Если строка пустая, возвращаем как есть
    if (str.length === 0) {
        return str
    }

    // Если visibleChars = 0, маскируем всю строку
    if (visibleChars === 0) {
        return ensureMinStars('*'.repeat(str.length))
    }

    // Если строка короче или равна количеству видимых символов, возвращаем как есть
    if (str.length <= visibleChars) {
        return str
    }

    let masked: string

    if (symmetric) {
        // Симметричный режим: показываем начало и конец
        const start = str.substring(0, visibleChars)
        const end = str.substring(str.length - visibleChars)
        const hiddenLength = str.length - visibleChars * 2
        
        // Если скрыто 0 или меньше символов, возвращаем строку как есть
        if (hiddenLength <= 0) {
            return str
        }
        
        if (hideLength) {
            // Скрываем реальное количество символов
            // Показываем меньше звездочек, но не меньше 3
            const starsCount = Math.max(3, Math.floor(hiddenLength * 0.3))
            masked = `${start}${'*'.repeat(starsCount)}${end}`
        } else {
            masked = `${start}${'*'.repeat(hiddenLength)}${end}`
            // Проверяем на одну звездочку только если не используем hideLength
            masked = ensureMinStars(masked)
        }
    } else {
        // Обычный режим: показываем только начало
        const start = str.substring(0, visibleChars)
        const hiddenLength = str.length - visibleChars
        
        if (hideLength) {
            // Скрываем реальное количество символов
            const starsCount = Math.max(3, Math.floor(hiddenLength * 0.3))
            masked = `${start}${'*'.repeat(starsCount)}`
        } else {
            masked = `${start}${'*'.repeat(hiddenLength)}`
            // Проверяем на одну звездочку только если не используем hideLength
            masked = ensureMinStars(masked)
        }
    }

    return masked
}

/**
 * Заменяет одну звездочку на три звездочки в замаскированной строке
 * 
 * @param masked - Замаскированная строка
 * @returns Строка с минимум тремя звездочками вместо одной
 */
function ensureMinStars(masked: string): string {
    // Оптимизированная проверка: ищем первую последовательность звездочек
    const firstStarIndex = masked.indexOf('*')
    if (firstStarIndex === -1) {
        return masked
    }

    // Находим конец последовательности звездочек
    let lastStarIndex = firstStarIndex
    while (lastStarIndex < masked.length && masked[lastStarIndex] === '*') {
        lastStarIndex++
    }

    const starsCount = lastStarIndex - firstStarIndex
    
    // Если звездочка только одна, заменяем на 3
    if (starsCount === 1) {
        return masked.substring(0, firstStarIndex) + '***' + masked.substring(lastStarIndex)
    }

    return masked
}

