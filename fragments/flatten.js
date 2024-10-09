export default async function (value, event) {
    if (value == undefined) return null
    switch (typeof value) {
        case 'string': case 'number': case 'boolean': return value
        case 'bigint': case 'symbol': return value.toString()
        case 'function': return undefined
    }
    switch (value?.constructor) {
        case Blob: return { size: value.size, type: value.type }
        case File: return { size: value.size, type: value.type, lastModified: value.lastModified, name: value.name }
        case DataTransferItem: return { kind: value.kind, type: value.type }
        case DataTransfer: return Object.defineProperties({ dropEffect: value.dropEffect, effectAllowed: value.effectAllowed, types: value.types },
            { files: { enumerable: true, get: () => this.flatten(value.files) }, items: { enumerable: true, get: () => this.flatten(value.items) } })
        case FileList: case DataTransferItemList: case Array:
            let a = []
            for (const f of value) a.push(this.flatten(f))
            return Promise.all(a)
        case FormData: return Object.fromEntries(value.entries())
        case Response:
            return Object.defineProperties({ ok: value.ok, redirected: value.redirected, status: value.status, statusText: value.statusText, type: value.type, url: value.url }, {
                body: { enumerable: true, get: () => this.parse(value) }, bodyUsed: { enumerable: true, get: () => value.bodyUsed },
                headers: { enumerable: true, get: () => Object.fromEntries(value.headers.entries()) }
            })
        default:
            if (typeof value.valueOf === 'function') return value.valueOf()
            else if ((value?.constructor === Object) || (value instanceof Event) || this.isPlainObject(value)) {
                let obj = {}, promises = []
                for (const k in value) promises.push(this.flatten(value[k]).then(v => obj[k] = v))
                return Promise.all(promises).then(() => obj)
            }
    }
    if (value instanceof this.Component) return await this.flatten(value.valueOf())
    if (value instanceof HTMLElement) {
        const { processElementMapper } = await this.runFragment('sys/mappers')
        return new Proxy({}, { get: (target, prop) => processElementMapper.call(this, value, prop, mappers), has: (target, prop) => processElementMapper.call(value, prop, mappers, true) })
    }
    for (const p in this) if ((p.charCodeAt(0) <= 90) && (this[p].prototype instanceof this[p]) && value instanceof this[p]) return value.valueOf()
}