export default async function (facet, position, envelope, value) {
    const { descriptor, variables } = envelope, { api: a, action: actionSignature } = descriptor, wrapped = variables && true,
        valueEnvelope = Object.freeze({ ...envelope, value }), api = await this.resolveUnit(variables?.api ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'api')
    if (!api) return
    const vAction = variables?.action, action = vAction ? this.resolveVariable(actionSignature, valueEnvelope, { wrapped }) : actionSignature
    if (vAction && !action) return
    return api.run(value, action, valueEnvelope)
}