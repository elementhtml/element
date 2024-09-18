export default async function (value, typeName) {
    this.app.libraries['application/schema+json'] ??= (await import('https://cdn.jsdelivr.net/npm/jema.js@1.1.7/schema.min.js')).Schema
    if (!this.app.types[typeName]) return
    const valid = this.app.types[typeName].validate(value), errors = valid ? undefined : this.app.types[typeName].errors(value)
    return { valid, errors }
}