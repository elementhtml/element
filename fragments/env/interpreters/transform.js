export default async function (facet, position, envelope, value) {
    const { descriptor } = envelope, { transform: transformKey, flag } = descriptor,
        valueEnvelope = Object.freeze({ ...envelope, value }), transform = await this.resolveUnit(transformKey, 'transform')
    return transform?.run(value, valueEnvelope, facet, position, { step, flag })
}