export default async function (envelope, value) {
    const { descriptor, variables } = envelope, wrapped = variables && true, valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined
    let { url, contentType } = descriptor
    if (!(url = this.resolveUrl(variables?.url ? this.resolveVariable(url, valueEnvelope, { wrapped }) : url))) return
    contentType = variables?.contentType ? this.resolveVariable(contentType, valueEnvelope, { wrapped }) : contentType
    if (value === null) value = { method: 'HEAD' }
    switch (typeof value) {
        case 'undefined': value = { method: 'GET' }; break
        case 'boolean': value = { method: value ? 'GET' : 'DELETE' }; break
        case 'bigint': value = value.toString(); break
        case 'number':
            value = { method: 'POST', headers: new Headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(value) }
            break
        case 'string':
            value = { method: 'POST', headers: new Headers(), body: value }
            const { valueAliases, regexp } = this.sys
            if (valueAliases[value.body] !== undefined) {
                value.body = JSON.stringify(valueAliases[value.body])
                value.headers.append('Content-Type', 'application/json')
            }
            else if (regexp.isJSONObject.test(value.body)) value.headers.append('Content-Type', 'application/json')
            else if (regexp.isFormString.test(value.body)) value.headers.append('Content-Type', 'application/x-www-form-urlencoded')
            break
        case 'object':
            if (value.body && (typeof value.body !== 'string')) value.body = await this.serialize(value.body, value.headers?.['Content-Type'])
            break
        default: return
    }
    const response = await fetch(url, value)
    return contentType === undefined ? this.flatten(response) : this.parse(response, contentType)
}