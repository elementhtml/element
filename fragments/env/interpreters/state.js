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
        const { group: target, shape } = this.getStateGroup(expression, typeDefault)
        return { signal: true, target, shape }
    }
}