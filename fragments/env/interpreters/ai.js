export default async function (container, position, envelope, value) {
    const { descriptor, variables } = envelope, { ai: m, prompt: p } = descriptor, wrapped = variables && true, valueEnvelope = Object.freeze({ ...envelope, value }),
        ai = await this.resolveUnit(variables?.ai ? this.resolveVariable(m, valueEnvelope, { wrapped }) : a, 'ai')
    if (!ai) return
    return ai.run(value, prompt, valueEnvelope)
}