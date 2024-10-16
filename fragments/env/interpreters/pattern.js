export default {
    handler: async function () {
        const { descriptor, variables } = envelope, { pattern: p } = descriptor, wrapped = variables && true,
            valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined,
            pattern = await this.resolveUnit(variables.pattern ? this.resolveVariable(p, valueEnvelope, { wrapped }) : p, 'pattern')
        if (!(pattern instanceof RegExp)) return
        pattern.lastIndex &&= 0
        const match = value.match(pattern), groups = match?.groups
        return groups ? Object.fromEntries(Object.entries(groups)) : (match ? match[1] : undefined)
    },
    parser: async function () {
        expression = expression.slice(1, -1)
        expression = (expression.endsWith('\\ ')) ? expression.trimStart() : expression.trim()
        expression.replaceAll('\\ ', ' ')
        return { pattern: expression }
    }
}