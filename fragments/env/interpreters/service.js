export default async function (facet, position, envelope, value) {
    const { descriptor, variables } = envelope, { service: a, action: actionSignature } = descriptor, wrapped = variables && true,
        valueEnvelope = Object.freeze({ ...envelope, value }), service = await this.resolveUnit(variables?.service ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'service')
    if (!service) return
    const vAction = variables?.action, action = vAction ? this.resolveVariable(actionSignature, valueEnvelope, { wrapped }) : actionSignature
    if (vAction && !action) return
    return service.run(value, action, valueEnvelope)
}