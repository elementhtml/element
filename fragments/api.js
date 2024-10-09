export default {
    run: async function (value, action, envelope) {
        const { E } = this
        if (this.preProcessor) value = await E.runUnit(this.preProcessor, 'transform', value)
        action = (action ? this.actions[action] : undefined) ?? { pathname: `/${('pathname' in this.options) ? (this.options.pathname || '') : (action || '')}` }
        const options = {
            ...this.options, ...(action?.options ?? {}),
            method: action.method ?? ({ null: 'HEAD', false: 'DELETE', true: 'GET', undefined: 'GET' })[value] ?? this.options.method,
            headers: { ...this.options.headers, ...(action?.options?.headers ?? {}) }
        }, merge = true, pathname = E.resolveVariable(action.pathname, envelope, { merge }),
            url = E.resolveUrl(pathname, E.resolveVariable(this.base, envelope, { merge }))
        if (value === 0 || (value && typeof value !== 'string')) {
            const contentType = options.headers['Content-Type'] ?? options.headers['content-type'] ?? action.contentType ?? this.contentType
            options.body = await E.runUnit(contentType, 'transform', value)
            if (typeof options.body !== 'string') throw new Error(`Input value unable to be serialized to "${contentType}".`)
        }
        const response = await fetch(url, options)
        let result
        if (response.ok) {
            const acceptType = options.headers.Accept ?? options.headers.accept ?? action.acceptType ?? this.acceptType
            result = await E.runUnit(acceptType, 'transform', await response.text())
            if (this.postProcessor) result = await E.runUnit(this.postProcessor, 'transform', result)
        } else if (this.errorProcessor) result = await E.runUnit(this.errorProcessor, 'transform', response)
        return result
    }
}