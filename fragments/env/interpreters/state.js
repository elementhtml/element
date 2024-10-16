const getStateGroup = function (expression, typeDefault = 'cell', element) {
    const parseOnly = !(element instanceof HTMLElement)
    let group, shape
    if (!parseOnly) element = this.app._components.virtuals.get(element) ?? element
    const canonicalizeName = (name) => {
        let type
        switch (name[0]) {
            case '@': type = 'field'; break
            case '#': type = 'cell'; break
            default: type = typeDefault
        }
        const modeFlag = name[name.length - 1],
            mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
        if (mode) name = name.slice(0, -1).trim()
        return { name: name, mode, type }
    }, getStateTarget = parseOnly ? undefined : (name, mode, type) => {
        switch (type) {
            case 'cell':
                return { cell: (new this.Cell(name)), type, mode }
            case 'field':
                return { field: (new this.Field(name, undefined, element)), type, mode }
        }
    }
    switch (expression[0]) {
        case '{':
            group = {}
            shape = 'object'
            for (const pair of expression.slice(1, -1).trim().split(',')) {
                let [key, rawName] = pair.trim().split(':').map(s => s.trim())
                if (!rawName) rawName = key
                const { name, mode, type } = canonicalizeName(rawName)
                if (mode) key = key.slice(0, -1)
                group[key] = { name, mode, type }
                if (!parseOnly) group[key][type] = getStateTarget(name, mode, type)
            }
            break
        case '[':
            group = []
            shape = 'array'
            for (let t of expression.slice(1, -1).split(',')) {
                t = t.trim()
                if (!t) continue
                const { name, mode, type } = canonicalizeName(t), index = group.push({ name, mode, type }) - 1
                if (!parseOnly) group[index][type] = getStateTarget(name, mode, type)
            }
            break
        default:
            shape = 'single'
            expression = expression.trim()
            if (!expression) return
            group = canonicalizeName(expression)
            if (!parseOnly) group = getStateTarget(group.name, group.mode, group.type)
    }
    if (parseOnly) return { group, shape }
    return group
}

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
    parser: async function (expression) {
        expression = expression.trim()
        const typeDefault = expression[0] === '@' ? 'field' : 'cell'
        expression = expression.slice(1).trim()
        const { group: target, shape } = getStateGroup.call(this, expression, typeDefault)
        return { signal: true, target, shape }
    }
}