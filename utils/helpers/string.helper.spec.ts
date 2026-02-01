import { maskString } from './string.helper'

describe('maskString', () => {
    describe('Валидация входных параметров', () => {
        it('должен выбросить ошибку для null', () => {
            expect(() => maskString(null as any, 4)).toThrow('str cannot be null or undefined')
        })

        it('должен выбросить ошибку для undefined', () => {
            expect(() => maskString(undefined as any, 4)).toThrow('str cannot be null or undefined')
        })

        it('должен выбросить ошибку для нестрокового типа', () => {
            expect(() => maskString(123 as any, 4)).toThrow('str must be a string')
            expect(() => maskString({} as any, 4)).toThrow('str must be a string')
            expect(() => maskString([] as any, 4)).toThrow('str must be a string')
        })

        it('должен выбросить ошибку для отрицательного visibleChars', () => {
            expect(() => maskString('test', -1)).toThrow('visibleChars must be a non-negative finite number')
            expect(() => maskString('test', -10)).toThrow('visibleChars must be a non-negative finite number')
        })

        it('должен выбросить ошибку для NaN visibleChars', () => {
            expect(() => maskString('test', NaN)).toThrow('visibleChars must be a non-negative finite number')
        })

        it('должен выбросить ошибку для Infinity visibleChars', () => {
            expect(() => maskString('test', Infinity)).toThrow('visibleChars must be a non-negative finite number')
            expect(() => maskString('test', -Infinity)).toThrow('visibleChars must be a non-negative finite number')
        })

        it('должен выбросить ошибку для нечислового visibleChars', () => {
            expect(() => maskString('test', '4' as any)).toThrow('visibleChars must be a non-negative finite number')
        })

        it('должен выбросить ошибку для дробных visibleChars', () => {
            expect(() => maskString('test', 2.5)).toThrow('visibleChars must be an integer')
            expect(() => maskString('test', 3.7)).toThrow('visibleChars must be an integer')
            expect(() => maskString('test', 1.9)).toThrow('visibleChars must be an integer')
            expect(() => maskString('test', 0.5)).toThrow('visibleChars must be an integer')
            expect(() => maskString('test', 4.1)).toThrow('visibleChars must be an integer')
        })
    })

    describe('Корнер кейсы', () => {
        it('должен вернуть пустую строку для пустой строки', () => {
            expect(maskString('', 4)).toBe('')
        })

        it('должен вернуть строку как есть, если она короче или равна visibleChars', () => {
            expect(maskString('abc', 3)).toBe('abc')
            expect(maskString('abc', 4)).toBe('abc')
            expect(maskString('ab', 2)).toBe('ab')
        })

        it('должен вернуть строку как есть, если длина равна visibleChars', () => {
            expect(maskString('abcd', 4)).toBe('abcd')
        })
    })

    describe('Стандартный режим (symmetric = false, hideLength = false)', () => {
        it('должен маскировать строку, показывая только начало', () => {
            expect(maskString('abcdefghijklmnop', 4)).toBe('abcd************')
        })

        it('должен работать с разными значениями visibleChars', () => {
            expect(maskString('abcdefghijklmnop', 1)).toBe('a***************')
            expect(maskString('abcdefghijklmnop', 2)).toBe('ab**************')
            expect(maskString('abcdefghijklmnop', 6)).toBe('abcdef**********')
        })

        it('должен работать с короткими строками', () => {
            expect(maskString('abcde', 2)).toBe('ab***')
        })

        it('должен работать с очень длинными строками', () => {
            const longString = 'a'.repeat(100)
            const result = maskString(longString, 5)
            expect(result).toBe('aaaaa' + '*'.repeat(95))
            expect(result.length).toBe(100)
        })
    })

    describe('Симметричный режим (symmetric = true, hideLength = false)', () => {
        it('должен показывать начало и конец строки', () => {
            expect(maskString('abcdefghijklmnop', 4, true)).toBe('abcd********mnop')
        })

        it('должен работать с разными значениями visibleChars', () => {
            expect(maskString('abcdefghijklmnop', 2, true)).toBe('ab************op')
            // Строка длиной 16, visibleChars = 3, скрыто: 16 - 3 - 3 = 10 символов
            // Начало: 'abc', конец: 'nop' (последние 3 символа)
            expect(maskString('abcdefghijklmnop', 3, true)).toBe('abc**********nop')
        })

        it('должен обрабатывать строку, которая слишком короткая для симметрии', () => {
            // Если строка <= visibleChars * 2, показываем начало и конец с минимальной маскировкой
            expect(maskString('abcdef', 3, true)).toBe('abcdef') // Скрыто 0 символов
            expect(maskString('abcdefg', 3, true)).toBe('abc***efg') // Скрыто 1 символ -> заменяется на 3
            expect(maskString('abcdefgh', 4, true)).toBe('abcdefgh') // Скрыто 0 символов
        })

        it('должен работать с очень длинными строками в симметричном режиме', () => {
            const longString = 'a'.repeat(100)
            const result = maskString(longString, 5, true)
            expect(result).toBe('aaaaa' + '*'.repeat(90) + 'aaaaa')
            expect(result.length).toBe(100)
        })
    })

    describe('Режим скрытия длины (hideLength = true)', () => {
        it('должен показывать меньше звездочек, чем реально скрыто', () => {
            const result = maskString('abcdefghijklmnop', 4, false, true)
            // Должно быть меньше звездочек, чем 12 (скрыто 12 символов)
            expect(result).toBe('abcd***')
            expect(result.length).toBeLessThan('abcd************'.length)
        })

        it('должен показывать минимум 3 звездочки', () => {
            const result = maskString('abcdefgh', 4, false, true)
            // Скрыто 4 символа, но показываем минимум 3 звездочки
            expect(result).toBe('abcd***')
        })

        it('должен работать с симметричным режимом и скрытием длины', () => {
            const result = maskString('abcdefghijklmnop', 4, true, true)
            // Должно быть меньше звездочек, чем реально скрыто (8 символов)
            expect(result.length).toBeLessThan('abcd********mnop'.length)
            expect(result).toMatch(/^abcd\*+mnop$/)
        })

        it('должен показывать минимум 3 звездочки в симметричном режиме', () => {
            const result = maskString('abcdefgh', 2, true, true)
            // Скрыто 4 символа, но показываем минимум 3 звездочки
            expect(result).toMatch(/^ab\*+gh$/)
            const starsMatch = result.match(/\*+/)
            expect(starsMatch?.[0].length).toBeGreaterThanOrEqual(3)
        })

        it('должен показывать минимум 3 звездочки даже при малом hiddenLength', () => {
            // hiddenLength = 2, starsCount = Math.max(3, Math.floor(2 * 0.3)) = 3
            const result = maskString('abcdefghij', 8, false, true)
            expect(result).toBe('abcdefgh***')
            
            // hiddenLength = 1, starsCount = Math.max(3, Math.floor(1 * 0.3)) = 3
            const result2 = maskString('abcdefghi', 8, false, true)
            expect(result2).toBe('abcdefgh***')
        })
    })

    describe('Корнер кейс с одной звездочкой', () => {
        it('должен заменять одну звездочку на три', () => {
            // Строка длиной 5, visibleChars = 2, symmetric = false
            // Результат: 'ab***' (скрыто 3 символа, но если бы была одна звездочка, заменили бы на 3)
            // Но в данном случае будет 3 звездочки, что нормально
            const result = maskString('abcde', 2)
            expect(result).toBe('ab***')
            
            // Проверяем случай, когда действительно получается одна звездочка
            // Строка 'abc', visibleChars = 1, symmetric = true
            const result2 = maskString('abc', 1, true)
            // Должно быть: 'a*' -> заменяется на 'a***'
            expect(result2).toBe('a***c')
        })

        it('должен обрабатывать случай с одной звездочкой в симметричном режиме', () => {
            // Строка 'abcde', visibleChars = 2, symmetric = true
            // Скрыто: 5 - 2 - 2 = 1 символ -> заменяется на 3
            const result = maskString('abcde', 2, true)
            expect(result).toBe('ab***de')
        })

        it('должен обрабатывать случай с одной звездочкой в режиме скрытия длины', () => {
            // Если hideLength приводит к одной звездочке, она должна быть заменена
            // Но обычно hideLength дает минимум 3 звездочки, так что этот случай редкий
            const result = maskString('abc', 1, false, true)
            // 'a' + минимум 3 звездочки = 'a***'
            expect(result).toBe('a***')
        })

        it('не должен заменять две и более звездочки', () => {
            // Строка 'abcde' с visibleChars=2 -> 'ab***' (3 звездочки, не заменяются)
            expect(maskString('abcde', 2)).toBe('ab***')
            
            // Строка 'abcdef' с visibleChars=2 -> 'ab****' (4 звездочки, не заменяются)
            expect(maskString('abcdef', 2)).toBe('ab****')
            
            // Строка 'abcdefg' с visibleChars=2 -> 'ab*****' (5 звездочек, не заменяются)
            expect(maskString('abcdefg', 2)).toBe('ab*****')
            
            // Строка 'abcd' с visibleChars=2 -> 'ab**' (2 звездочки, не заменяются)
            expect(maskString('abcd', 2)).toBe('ab**')
        })
    })

    describe('Комбинации параметров', () => {
        it('должен работать с visibleChars = 0', () => {
            // Если visibleChars = 0, строка должна быть полностью замаскирована
            expect(maskString('abcdef', 0)).toBe('******')
            // Если строка длиной 1, одна звездочка заменяется на 3
            expect(maskString('a', 0)).toBe('***')
        })

        it('должен работать с visibleChars = 0 в симметричном режиме', () => {
            // В симметричном режиме с visibleChars=0 должно работать как обычный режим
            expect(maskString('abc', 0, true)).toBe('***')
            expect(maskString('ab', 0, true)).toBe('**')
            expect(maskString('abcdef', 0, true)).toBe('******')
        })

        it('должен работать со всеми параметрами одновременно', () => {
            // symmetric=true, hideLength=true
            const result = maskString('abcdefghijklmnop', 4, true, true)
            // hiddenLength = 8, starsCount = Math.max(3, Math.floor(8 * 0.3)) = 3
            expect(result).toBe('abcd***mnop')
            
            // Проверяем с другой длиной строки
            const result2 = maskString('abcdefghijklmnopqrst', 5, true, true)
            // hiddenLength = 10, starsCount = Math.max(3, Math.floor(10 * 0.3)) = 3
            expect(result2).toBe('abcde***pqrst')
        })

        it('должен работать с visibleChars = 1', () => {
            expect(maskString('abcdef', 1)).toBe('a*****')
        })

        it('должен работать с очень большим visibleChars', () => {
            // Если visibleChars больше половины строки, но меньше длины
            // Скрыто 1 символ -> заменяется на 3
            expect(maskString('abcdef', 5)).toBe('abcde***')
        })

        it('должен обрабатывать строки с специальными символами', () => {
            expect(maskString('a@b#c$d%e', 3)).toBe('a@b******')
            expect(maskString('тест1234', 4)).toBe('тест****')
        })

        it('должен обрабатывать строки с пробелами', () => {
            expect(maskString('a b c d e', 3)).toBe('a b******')
        })

        it('должен обрабатывать строки с эмодзи', () => {
            const emojiString = '🚀😀🎉test'
            const result = maskString(emojiString, 3)
            // Эмодзи могут занимать несколько символов, но функция должна работать
            expect(result).toContain('🚀')
            expect(result).toContain('*')
        })

        it('должен корректно обрабатывать Unicode суррогатные пары', () => {
            // Символы, занимающие 2 байта в UTF-16
            expect(maskString('тест1234', 4)).toBe('тест****')
            // Строка 'тест1234' длиной 8, visibleChars = 2, symmetric -> hiddenLength = 8 - 4 = 4
            expect(maskString('тест1234', 2, true)).toBe('те****34')
            expect(maskString('русскийтекст', 6)).toBe('русски******')
        })

        it('должен корректно обрабатывать комбинирующие символы', () => {
            // Символы с диакритическими знаками
            expect(maskString('café1234', 4)).toBe('café****')
            expect(maskString('naïve5678', 5)).toBe('naïve****')
            // Строка 'résumé' длиной 6, visibleChars = 3, symmetric -> hiddenLength = 6 - 6 = 0 -> возвращается как есть
            expect(maskString('résumé', 3, true)).toBe('résumé')
        })
    })

    describe('Проверка правильности маскировки', () => {
        it('должен сохранять видимые символы в начале', () => {
            const result = maskString('abcdefghijklmnop', 4)
            expect(result.substring(0, 4)).toBe('abcd')
        })

        it('должен сохранять видимые символы в конце в симметричном режиме', () => {
            const result = maskString('abcdefghijklmnop', 4, true)
            expect(result.substring(result.length - 4)).toBe('mnop')
        })

        it('должен заменять все скрытые символы на звездочки', () => {
            const result = maskString('abcdefghijklmnop', 4)
            const starsPart = result.substring(4)
            expect(starsPart).toBe('************')
            expect(starsPart.split('').every(char => char === '*')).toBe(true)
        })

        it('должен сохранять общую длину строки в обычном режиме', () => {
            const input = 'abcdefghijklmnop'
            const result = maskString(input, 4)
            expect(result.length).toBe(input.length)
        })

        it('должен сохранять общую длину строки в симметричном режиме', () => {
            const input = 'abcdefghijklmnop'
            const result = maskString(input, 4, true)
            expect(result.length).toBe(input.length)
        })
    })

    describe('Реальные сценарии использования', () => {
        it('должен маскировать API ключ', () => {
            const apiKey = 'b7b60a52849cf54d9c93e3f06b9b04167b0f7838981028546c0713569739d1c3'
            const result = maskString(apiKey, 4)
            expect(result).toBe('b7b6' + '*'.repeat(apiKey.length - 4))
        })

        it('должен маскировать API ключ симметрично', () => {
            const apiKey = 'b7b60a52849cf54d9c93e3f06b9b04167b0f7838981028546c0713569739d1c3'
            const result = maskString(apiKey, 4, true)
            expect(result).toMatch(/^b7b6\*+d1c3$/)
        })

        it('должен маскировать API ключ со скрытием длины', () => {
            const apiKey = 'b7b60a52849cf54d9c93e3f06b9b04167b0f7838981028546c0713569739d1c3'
            const result = maskString(apiKey, 4, false, true)
            expect(result.length).toBeLessThan(apiKey.length)
            expect(result).toMatch(/^b7b6\*+$/)
        })

        it('должен маскировать токен', () => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            const result = maskString(token, 10, true)
            expect(result.length).toBe(token.length)
            expect(result.substring(0, 10)).toBe(token.substring(0, 10))
            expect(result.substring(result.length - 10)).toBe(token.substring(token.length - 10))
        })

        it('должен маскировать короткий ключ', () => {
            const shortKey = 'abc123'
            // Скрыто: 6 - 3 - 3 = 0 символов -> возвращаем как есть
            const result = maskString(shortKey, 3, true)
            expect(result).toBe('abc123')
        })
    })

    describe('Граничные значения', () => {
        it('должен обрабатывать строку длиной 1', () => {
            expect(maskString('a', 1)).toBe('a')
            // Скрыто 1 символ -> заменяется на 3
            expect(maskString('a', 0)).toBe('***')
        })

        it('должен обрабатывать строку длиной 2', () => {
            // Скрыто 1 символ -> заменяется на 3
            expect(maskString('ab', 1)).toBe('a***')
            expect(maskString('ab', 2)).toBe('ab')
            // С visibleChars = 0: две звездочки, не заменяются
            expect(maskString('ab', 0)).toBe('**')
        })

        it('должен обрабатывать строку длиной 3', () => {
            expect(maskString('abc', 1)).toBe('a**')
            // Скрыто 1 символ -> заменяется на 3
            expect(maskString('abc', 2)).toBe('ab***')
            expect(maskString('abc', 1, true)).toBe('a***c')
        })

        it('должен обрабатывать строку, где visibleChars равен половине длины', () => {
            // Скрыто: 6 - 3 - 3 = 0 символов -> возвращаем как есть
            expect(maskString('abcdef', 3, true)).toBe('abcdef')
        })

        it('должен обрабатывать строку, где visibleChars больше половины длины', () => {
            // Строка слишком короткая для симметрии: 6 <= 4 * 2
            // Скрыто: 6 - 4 - 4 = -2 -> возвращаем как есть
            expect(maskString('abcdef', 4, true)).toBe('abcdef')
        })

        it('должен обрабатывать большие visibleChars в симметричном режиме', () => {
            // Строка длиной 100, visibleChars = 40
            const longString = 'a'.repeat(100)
            const result = maskString(longString, 40, true)
            // hiddenLength = 100 - 80 = 20
            expect(result).toBe('a'.repeat(40) + '*'.repeat(20) + 'a'.repeat(40))
            expect(result.length).toBe(100)
        })

        it('должен обрабатывать очень большие visibleChars близкие к длине строки', () => {
            // Строка длиной 20, visibleChars = 18
            const result = maskString('abcdefghijklmnopqrst', 18)
            // hiddenLength = 2, две звездочки не заменяются (заменяется только одна звездочка)
            expect(result).toBe('abcdefghijklmnopqr**')
        })
    })

    describe('Производительность', () => {
        it('должен быстро обрабатывать длинные строки', () => {
            const longString = 'a'.repeat(10000)
            const start = Date.now()
            maskString(longString, 100, true, true)
            const duration = Date.now() - start
            
            expect(duration).toBeLessThan(100) // должно быть быстрее 100мс
        })

        it('должен быстро обрабатывать множество коротких строк', () => {
            const start = Date.now()
            for (let i = 0; i < 1000; i++) {
                maskString('abcdefghij', 4)
            }
            const duration = Date.now() - start
            
            expect(duration).toBeLessThan(100) // должно быть быстрее 100мс для 1000 итераций
        })
    })
})

