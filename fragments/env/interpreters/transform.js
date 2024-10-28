export default async function (facet, position, envelope, value) {
    const { descriptor } = envelope, { transform: transformKey, step, flag } = descriptor,
        valueEnvelope = Object.freeze({ ...envelope, value }), transform = await this.resolveUnit(transformKey, 'transform')

    console.log(transform)

    return transform?.run(value, valueEnvelope, facet, position, { step, flag })
}