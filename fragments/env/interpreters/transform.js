export default async function (facet, position, envelope, value) {
    const { descriptor } = envelope, { transform: transformKey, step } = descriptor, args = [],
        valueEnvelope = Object.freeze({ ...envelope, value }), transform = await this.resolveUnit(transformKey, 'transform')
    for (const a of descriptor.args) args.push(this.resolveVariable(a, valueEnvelope, { wrapped: false }))
    return transform?.run(value, valueEnvelope, facet, position, { step, args })
}