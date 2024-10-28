export default {
    run: async function (input, envelope, step, flag) {
        const { isProxy, steps } = this, { E } = this.constructor, state = {}
        if (isProxy) return steps[step ?? '*'].call(E, input, state, envelope, this)
        if (step && steps.has(step)) return steps.get(step)?.call(E, input, state, envelope, this)
        const hasFlag = !!flag, isArray = hasFlag ? Array.isArray(input) : undefined, isObject = hasFlag ? (!isArray && this.isPlainObject(input)) : undefined,
            useSteps = step.includes(':') ? E.sliceAndStep(step, steps.values()) : steps.values(), asEntries = flag === '{:}'
        switch (flag) {
            case '[]': if (!isArray) input = isObject ? Object.values(input) : [input]; break
            case '{}': case '{:}':
                if (isArray) input = Object.fromEntries(input.entries())
                else if (!isObject) input = { 0: input }
                if (asEntries) input = [...Object.entries(input)]
        }
        if (isArray) {
            const result = []
            for (let item of input) {
                for (const step of useSteps) if ((item = await step.call(E, item, state, envelope, this)) === undefined) break
                if (item !== undefined) result.push(item)
            }
            input = result.length ? result : undefined
        } else if (isObject) {
            let result
            if (asEntries) {
                const entries = []
                for (let entry of input) {
                    for (const step of useSteps) if ((entry = await step.call(E, entry, state, envelope, this)) === undefined) break
                    if (entry && Array.isArray(entry) && (entry.length === 2)) entries.push(entry)
                }
                result = Object.fromEntries(entries)
            } else {
                result = {}
                for (const key in input) {
                    let v = input[k]
                    for (const step of useSteps) if ((v = await step.call(E, v, state, envelope, this)) === undefined) break
                    if (v !== undefined) result[key] = v
                }
            }
            input = Object.keys(result).length ? result : undefined
        } else {
            for (const step of useSteps) if ((input = await step.call(E, input, state, envelope, this)) === undefined) break
        }
        return input
    }
}