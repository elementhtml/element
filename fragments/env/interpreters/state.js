export default {
    handler: async function (facet, position, envelope, value) {
        const { descriptor } = envelope, { getReturnValue, shape, target } = descriptor
        if (value == undefined) return getReturnValue()
        switch (shape) {
            case 'single': target[target.type].set(value, target.mode); break
            case 'array': if (Array.isArray(value)) for (let i = 0, v, t, l = value.length; i < l; i++) if ((v = value[i]) !== undefined) (t = target[i])[t.type].set(v, t.mode); break
            case 'object': if (value instanceof Object) for (const k in value) if (value[k] !== undefined) if (k in target) target[k][target[k].type].set(value[k], target[k].mode)
        }
    },
    binder: async function (facet, position, envelope) {
        const { descriptor } = envelope, { signal, shape } = descriptor, items = []
        let { target } = descriptor, getReturnValue
        switch (shape) {
            case 'single':
                const { type, name } = target
                target[type] = type === 'field' ? (new this.Field(name, facet)) : (new this.Cell(name))
                getReturnValue = () => target[type].get()
                items.push(target)
                break
            case 'array':
                for (const t of target) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(t.name, facet)) : (new this.Cell(t.name))
                getReturnValue = (r = [], l) => {
                    for (const t of target) if ((r[l ??= r.length] = t[t.type].get()) === undefined) return
                    return r
                }
                break
            case 'object':
                if (Array.isArray(target)) target = Object.fromEntries(target)
                for (const t of Object.values(target)) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(t.name, facet)) : (new this.Cell(t.name))
                getReturnValue = (r = {}, tk) => {
                    for (const k in target) if ((r[k] = (tk = target[k])[tk.type].get()) === undefined) return
                    return r
                }
        }
        for (const item of items) {
            item[item.type].eventTarget.addEventListener('change', () => {
                const detail = getReturnValue()
                if (detail !== undefined) facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
            }, { signal })
        }
        return { getReturnValue, target }
    },
    parser: async function (expression) {
        expression = expression.trim()
        const typeDefault = expression[0] === '@' ? 'field' : 'cell'
        expression = expression.slice(1).trim()
        const { group: target, shape } = this.getStateGroup(expression, typeDefault)
        return { signal: true, target, shape }
    }
}