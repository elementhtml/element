export default async function (facet, position, envelope, value) {
    const { sys } = this, { location } = document, { descriptor } = envelope, { expression } = descriptor
    let result
    if (expression in sys.locationKeyMap) {
        const locationKey = sys.locationKeyMap[expression]
        if (typeof value === 'string') location[locationKey] = value
        return location[locationKey].slice(1) || undefined
    }
    if (expression !== ':') return
    if (value !== undefined) {
        switch (typeof value) {
            case 'string': location = value; break
            case 'object':
                if (!value) break
                for (const k in value) {
                    const v = value[k]
                    if (k.endsWith('()')) {
                        const funcName = k.trim().slice(0, -2).trim()
                        switch (funcName) {
                            case 'assign': case 'replace': location[funcName]((funcName === 'assign' || funcName === 'replace') ? v : undefined); break
                            case 'back': case 'forward': history[funcName](); break
                            case 'go': history[funcName](parseInt(v) || 0); break
                            case 'pushState': case 'replaceState': history[funcName](...(Array.isArray(v) ? v : [v]))
                        }
                        continue
                    }
                    if (typeof v === 'string') location[k] = v
                }
        }

    }
    result = {}
    for (const k in location) if (typeof location[k] !== 'function') result[k] = location[k]
    result.ancestorOrigins = Array.from(result.ancestorOrigins)
    result.path = result.pathname.replace(sys.regexp.leadingSlash, '')
    return result
}