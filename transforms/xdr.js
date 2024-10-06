const application = (E) => {
    return new E.transform(async (input, envelope) => {
        const XDR = await E.resolveUnit('xdr', 'library'), { state } = envelope, { response = {} } = state
        let xTypeHeader = state.type ?? response?.headers?.['x-type'], typeDef
        if (xTypeHeader) {
            const { url, headers = {} } = response
            let options = { baseURI: 'baseuri', name: 'name', namespace: 'namespace', includes: 'includes' }
            for (const k in options) options[k] = state[k] ?? headers[`x-options-${k}`]
            let entry = state.entry ?? headers['x-entry'] ?? E.resolveUrl(url, undefined, true).pathname.split('/').pop().replace('.x', '').trim()
            typeDef = await XDR.factory(E.resolveUrl(xTypeHeader, url), entry, options)
        }
        return XDR.parse(input, typeDef)
    })
}
const text = (E) => {
    return new E.transform(async (input, envelope) => {
        if (typeof input !== 'string') return
        const XDR = await E.resolveUnit('xdr', 'library'), { state } = envelope, { response = {} } = state, { headers = {} } = response
        let options = { baseURI: 'baseuri', name: 'name', namespace: 'namespace', includes: 'includes' }
        for (const k in options) options[k] = state[k] ?? headers[`x-options-${k}`]
        let entry = state.entry ?? headers['x-entry']
        if (response.url && (!entry || !options.baseURI || !options.name)) {
            const { url } = response, { pathname, href } = E.resolveUrl(url, undefined, true), filename = pathname.split('/').pop().replace('.x', '').trim()
            options.baseURI ??= href
            entry ??= filename
            options.name ??= filename
        }
        if (options.includes) options.includes = await E.resolveUnit(options.includes, 'library')
        return XDR.factory(input, entry, options)
    })
}
export { application, text }
