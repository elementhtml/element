export default async function (facet, position, envelope, value) {
    let { descriptor, variables } = envelope, { transform: t } = descriptor, vTransform = variables?.transform, wrapped = vTransform && true,
        valueEnvelope = vTransform ? Object.freeze({ ...envelope, value }) : envelope,
        transform = await this.resolveUnit(vTransform ? this.resolveVariable(t, valueEnvelope, { wrapped }) : t, 'transform')
    return transform?.run(value, facet, valueEnvelope)
}