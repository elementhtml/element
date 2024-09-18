const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '2.0.0' }, // optimal

    env: {
        enumerable: true, value: {
            apis: {}, components: {}, content: {}, context: {}, facets: {},
            gateways: {
                'ipfs:': [{ gateway: '{path|/|0}.ipfs.localhost:8080/{path|/|1:}', head: 'ipfs.localhost:8080', auto: true }, { gateway: '{path|/|0}.ipfs.dweb.link/{path|/|1:}', head: 'ipfs.dweb.link', auto: true }],
                'ipns:': [{ gateway: '{path|/|0}.ipns.localhost:8080/{path|/|1:}', head: 'ipns.localhost:8080', auto: true }, { gateway: '{path|/|0}.ipns.dweb.link/{path|/|1:}', head: 'ipns.dweb.link', auto: true }],
                'ar:': [{
                    gateway: function (useHost = {}, gatewayArgs = {}) {
                        if (typeof useHost !== 'string') return fetch(`${window.location.protocol}//localhost:1984`, { method: 'HEAD' }).then(r => r.ok ? 'localhost:1984' : 'arweave.net')
                        const [txid, ...chunks] = gatewayArgs.path.split('/')
                        return (txid.length === 43 && txid.includes('.')) ? `${useHost}/${txid}/${chunks.join('/')}` : `${txid}.arweave.net/${chunks.join('/')}`
                    }, auto: true
                }],
                'bzz:': [{ gateway: 'localhost:1633/bzz/{host}/{path}', head: 'localhost:1633/bzz/swarm.eth', auto: true }, { gateway: 'gateway.ethswarm.org/bzz/{host}/{path}', head: 'gateway.ethswarm.org/bzz/swarm.eth', auto: true }],
                'eth:': [{ gateway: '{path}.link/{path|/|1:}', head: 'eth.link', auto: true }]
            },
            hooks: {},
            interpreters: new Map([
                [/^[#?/:]$/, {
                    name: 'router',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { expression } = descriptor
                        let result
                        if (expression in this.sys.locationKeyMap) {
                            const locationKey = this.sys.locationKeyMap[expression]
                            if (typeof value === 'string') document.location[locationKey] = value
                            return document.location[locationKey].slice(1) || undefined
                        }
                        if (expression !== ':') return
                        switch (typeof value) {
                            case 'string': document.location = value; break
                            case 'object':
                                if (!value) break
                                for (const k in value) {
                                    const v = value[k]
                                    if (k.endsWith('()')) {
                                        const funcName = k.trim().slice(0, -2).trim()
                                        switch (funcName) {
                                            case 'assign': case 'replace': document.location[funcName]((funcName === 'assign' || funcName === 'replace') ? v : undefined); break
                                            case 'back': case 'forward': history[funcName](); break
                                            case 'go': history[funcName](parseInt(v) || 0); break
                                            case 'pushState': case 'replaceState': history[funcName](...(Array.isArray(v) ? v : [v]))
                                        }
                                        continue
                                    }
                                    if (typeof v === 'string') document.location[k] = v
                                }
                        }
                        result = {}
                        for (const k in document.location) if (typeof document.location[k] !== 'function') result[k] = document.location[k]
                        result.ancestorOrigins = Array.from(result.ancestorOrigins)
                        result.path = result.pathname.replace(this.sys.regexp.leadingSlash, '')
                        return result
                    },
                    binder: async function (container, position, envelope) { // optimal
                        const { descriptor } = envelope, { signal } = descriptor
                        if (signal) window.addEventListener('hashchange', () => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash.slice(1) })), { signal })
                    }
                }],
                [/^(true|false|null|[.!-]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(\.\d+)?)$/, {
                    name: 'value',
                    handler: async function (container, position, envelope, value) { // optimal
                        return envelope.descriptor.value
                    }
                }],
                [/^\$\{.*\}$/, {
                    name: 'variable',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, cells, context, fields, labels } = envelope
                        return this.resolveVariable(descriptor.expression, { wrapped: false }, { cells, context, fields, labels, value })
                    }
                }],
                [/^[{](.*?)[}]$|^[\[](.*?)[\]]$|^\?[^ ]+$/, {
                    name: 'shape',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, cells, context, fields, labels } = envelope
                        return this.resolveVariable(descriptor.shape, { wrapped: false }, { cells, context, fields, labels, value })
                    }
                }],
                [/^#\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'content',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, cells, context, fields, labels } = envelope, { anthology, article } = descriptor
                        // yet to do!
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, cells, context, fields, labels } = envelope, { anthology, article } = descriptor
                        // possibly something to pre-load content here
                    }
                }],
                [/^\(.*\)$/, {
                    name: 'transform',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, cells, context, fields, labels } = envelope
                        return this.runTransform(descriptor.expression, value, container, { cells, context, fields, labels, value })
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, cells, context, fields, labels } = envelope, { expression } = descriptor
                        // possibly something to pre-load transformers here
                    }
                }],
                [/^\/.*\/$/, {
                    name: 'pattern',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { regexp } = descriptor
                        if (typeof value !== 'string') value = `${value}`
                        if (regexp.lastIndex) regexp.lastIndex = 0
                        const match = value.match(regexp)
                        return match?.groups ? Object.fromEntries(Object.entries(match.groups)) : (match ? match[1] : undefined)
                    },
                    binder: async function (container, position, envelope) {
                        // do something to  allow to lazy loading of patterns
                        const { descriptor } = envelope, { expression } = descriptor,
                            regexp = expression[0] === '~' ? (this.env.patterns[expression.slice(1)] ?? /(?!)/) : new RegExp(expression)
                        return { regexp }
                    }
                }],
                [/^\|.*\|$/, {
                    name: 'type',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { types, mode } = descriptor
                        let pass
                        switch (mode) {
                            case 'any':
                                for (const { if: ifMode, name } of types) if (pass = ifMode === (await this.checkType(name, value))) break
                                break
                            case 'all':
                                for (const { if: ifMode, name } of types) if (!(pass = ifMode === (await this.checkType(name, value)))) break
                                break
                            case 'info':
                                pass = true
                                const validation = {}
                                for (const { name } of types) validation[name] = await this.checkType(name, value, true)
                                return { value, validation }
                        }
                        if (pass) return value
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { types, mode } = descriptor
                        for (typeExpression of types) {
                            // do something to pre-load this type class 
                        }
                    }
                }],
                [/^\$\(.*\)$/, {
                    name: 'selector',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { scope, selector } = descriptor
                        if (value != undefined) {
                            const target = this.resolveSelector(selector, scope)
                            if (Array.isArray(target)) {
                                for (const t of target) this.render(t, value)
                            } else if (target) {
                                this.render(target, value)
                            }
                        }
                        return value
                    },
                    binder: async function (container, position, envelope) { // optimal
                        const { descriptor } = envelope, { signal } = descriptor, { scope: scopeStatement, selector: selectorStatement } = descriptor, scope = this.resolveScope(scopeStatement, container)
                        if (!scope) return {}
                        const lastIndexOfBang = selectorStatement.lastIndexOf('!')
                        let selector = selectorStatement.trim(), eventList
                        if (lastIndexOfBang > selector.lastIndexOf(']') && lastIndexOfBang > selector.lastIndexOf(')') && lastIndexOfBang > selector.lastIndexOf('"') && lastIndexOfBang > selector.lastIndexOf("'"))
                            [selector, eventList] = [selector.slice(0, lastIndexOfBang).trim(), selector.slice(lastIndexOfBang + 1).trim()]
                        if (eventList) {
                            eventList = eventList.split(this.sys.regexp.commaSplitter).filter(Boolean)
                        } else if (container.dataset.facetCid) {
                            const [statementIndex, stepIndex] = position.split('-')
                            if (!this.app.facets.classes[container.dataset.facetCid]?.statements?.[+statementIndex]?.steps[+stepIndex + 1]) return { selector, scope }
                        }
                        const eventNames = eventList ?? Array.from(new Set(Object.values(this.sys.defaultEventTypes).concat(['click'])))
                        for (let eventName of eventNames) {
                            const eventNameSlice3 = eventName.slice(-3), keepDefault = eventNameSlice3.includes('+'), exactMatch = eventNameSlice3.includes('='), once = eventNameSlice3.includes('-')
                            if (keepDefault) eventName = eventName.replace('+', '')
                            if (exactMatch) eventName = eventName.replace('=', '')
                            if (once) eventName = eventName.replace('-', '')
                            scope.addEventListener(eventName, event => {
                                let targetElement
                                if (selector.endsWith('}') && selector.includes('{')) {
                                    targetElement = this.resolveSelector(selector, scope)
                                    if (!targetElement || (Array.isArray(targetElement) && !targetElement.length)) return
                                } else if (selector[0] === '$') {
                                    if (selector.length === 1) return
                                    const catchallSelector = this.buildCatchallSelector(selector)
                                    targetElement = exactMatch ? event.target : event.target.closest(selector)
                                    if (!targetElement.matches(catchallSelector)) return
                                } else if (selector && exactMatch && !event.target.matches(selector)) { return }
                                targetElement ??= (exactMatch ? event.target : event.target.closest(selector))
                                if (!targetElement) return
                                const tagDefaultEventType = targetElement.constructor.events?.default ?? this.sys.defaultEventTypes[targetElement.tagName.toLowerCase()] ?? 'click'
                                if (!eventList && (event.type !== tagDefaultEventType)) return
                                if (!keepDefault) event.preventDefault()
                                container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(targetElement, undefined, event) }))
                            }, { signal, once })
                        }
                        return { selector, scope }
                    }
                }],
                [/^[#@](?:[a-zA-Z0-9]+|[{][a-zA-Z0-9#@?!, ]*[}]|[\[][a-zA-Z0-9#@?!, ]*[\]])$/, {
                    name: 'state',
                    handler: async function (container, position, envelope, value) { // optimal - but maybe needs to == undefined for a reason?
                        const { descriptor } = envelope, { getReturnValue, shape, target } = descriptor
                        if (value === undefined) return getReturnValue()
                        switch (shape) {
                            case 'single': target[target.type].set(value, target.mode); break
                            case 'array': if (Array.isArray(value)) for (let i = 0, v, t, l = value.length; i < l; i++) if ((v = value[i]) !== undefined) (t = target[i])[t.type].set(v, t.mode); break
                            case 'object': if (value instanceof Object) for (const k in value) if (value[k] !== undefined) if (k in target) target[k][target[k].type].set(value[k], target[k].mode)
                        }
                    },
                    binder: async function (container, position, envelope) { // optimal
                        const { descriptor } = envelope, { signal, shape } = descriptor, items = []
                        let { target } = descriptor, getReturnValue
                        switch (shape) {
                            case 'single':
                                target[target.type] = target.type === 'field' ? (new this.Field(container, target.name)) : (new this.Cell(target.name))
                                getReturnValue = () => target[target.type].get()
                                items.push(target)
                                break
                            case 'array':
                                for (const t of target) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(container, t.name)) : (new this.Cell(t.name))
                                getReturnValue = () => {
                                    const r = []
                                    for (const t of target) if ((r[r.length] = t[t.type].get()) === undefined) return
                                    return r
                                }
                                break
                            case 'object':
                                if (Array.isArray(target)) target = Object.fromEntries(target)
                                for (const t of Object.values(target)) (items[items.length = t])[t.type] = t.type === 'field' ? (new this.Field(container, t.name)) : (new this.Cell(t.name))
                                getReturnValue = () => {
                                    const r = {}
                                    for (const k in target) if ((r[k] = target[k][target[k].type].get()) === undefined) return
                                    return r
                                }
                        }
                        for (const item of items) {
                            item[item.type].eventTarget.addEventListener('change', () => {
                                const detail = getReturnValue()
                                if (detail !== undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                            }, { signal })
                        }
                        return { getReturnValue, shape, target }
                    }
                }],
                [/^!\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'api',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, cells, context, fields, labels } = envelope, { api, action } = descriptor
                        // yet to do!
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, cells, context, fields, labels } = envelope, { api, action } = descriptor
                        // possibly something to pre-load apis here
                    }
                }],
                [/^@\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'ai',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, cells, context, fields, labels } = envelope, { model, prompt } = descriptor
                        // yet to do!
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, cells, context, fields, labels } = envelope, { model, prompt } = descriptor
                        // possibly something to pre-load models here
                    }
                }],
                [/^`[^`]+(\|[^`]+)?`$/, {
                    name: 'request',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { labels, cells, context, fields, descriptor } = envelope
                        let { url, contentType } = descriptor
                        url = this.resolveUrl(this.resolveVariable(url, { wrapped: false }, { cells, context, fields, labels, value }))
                        if (!url) return
                        contentType = this.resolveVariable(contentType, { wrapped: false }, { cells, context, fields, labels, value })
                        if (value === null) value = { method: 'HEAD' }
                        switch (typeof value) {
                            case 'undefined': value = { method: 'GET' }; break
                            case 'boolean': value = { method: value ? 'GET' : 'DELETE' }; break
                            case 'bigint':
                                value = value.toString()
                            case 'number':
                                value = { method: 'POST', headers: new Headers(), body: JSON.stringify(value) }
                                value.headers.append('Content-Type', 'application/json')
                                break
                            case 'string':
                                value = { method: 'POST', headers: new Headers(), body: value }
                                const { valueAliases, regexp } = this.sys
                                if (valueAliases[value.body] !== undefined) {
                                    value.body = JSON.stringify(valueAliases[value.body])
                                    value.headers.append('Content-Type', 'application/json')
                                } else if (regexp.isJSONObject.test(value.body)) {
                                    value.headers.append('Content-Type', 'application/json')
                                } else if (regexp.isFormString.test(value.body)) {
                                    value.headers.append('Content-Type', 'application/x-www-form-urlencoded')
                                }
                                break
                            case 'object':
                                if (value.body && (typeof value.body !== 'string')) value.body = await this.serialize(value.body, value.headers?.['Content-Type'])
                                break
                            default:
                                return
                        }
                        const response = await fetch(url, value)
                        return contentType === undefined ? this.flatten(response) : this.parse(response, contentType)
                    },
                    binder: async function (container, position, envelope) {
                        // do something to  allow to lazy loading of contentType transformer to transforms and gateway to gateways
                        const { labels, cells, context, fields, descriptor } = envelope
                        let { url, contentType } = descriptor
                    }
                }],
                [/^_.*_$/, {
                    name: 'wait',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, labels, fields, cells, context } = envelope, { expression } = descriptor,
                            done = () => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: value })), now = Date.now()
                        let ms = 0
                        if (expression === 'frame') {
                            await new Promise(resolve => globalThis.requestAnimationFrame(resolve))
                        } else if (expression.startsWith('idle')) {
                            let timeout = expression.split(':')[0]
                            timeout = timeout ? (parseInt(timeout) || 1) : 1
                            await new Promise(resolve => globalThis.requestIdleCallback ? globalThis.requestIdleCallback(resolve, { timeout }) : setTimeout(resolve, timeout))
                        } else if (expression[0] === '+') {
                            ms = parseInt(this.resolveVariable(expression.slice(1), { wrapped: false }, { cells, context, fields, labels, value })) || 1
                        } else if (this.sys.regexp.isNumeric.test(expression)) {
                            ms = (parseInt(expression) || 1) - now
                        } else {
                            expression = this.resolveVariable(expression, { wrapped: false }, { cells, context, fields, labels, value })
                            const expressionSplit = expression.split(':').map(s => s.trim())
                            if ((expressionSplit.length === 3) && expressionSplit.every(s => this.sys.regexp.isNumeric.test(s))) {
                                ms = Date.parse(`${(new Date()).toISOString().split('T')[0]}T${expression}Z`)
                                if (ms < 0) ms = (ms + (1000 * 3600 * 24))
                                ms = ms - now
                            } else {
                                ms = Date.parse(expression) - now
                            }
                        }
                        if (ms) await new Promise(resolve => setTimeout(resolve, Math.max(ms, 0)))
                        done()
                    }
                }],
                [/^\$\`[^`]+\`$/, {
                    name: 'command',
                    handler: async function (container, position, envelope, value) { // optimal
                        if (this.modules.dev) $([envelope.descriptor.invocation])
                        return value
                    }
                }],
                [/^\$\??$/, {
                    name: 'console',
                    handler: async function (container, position, envelope, value) { // optimal
                        if (this.modules.dev) (envelope.descriptor.verbose === true) ? (console.log(this.flatten({ container, position, envelope, value }))) : (console.log(value))
                        return value
                    }
                }]
            ]),
            models: {},
            namespaces: { e: (new URL(`./components`, import.meta.url)).href },
            patterns: {}, resolvers: {}, snippets: {},
            transforms: {
                'application/schema+json': async function (value, typeName) {
                    this.app.libraries['application/schema+json'] ??= (await import('https://cdn.jsdelivr.net/npm/jema.js@1.1.7/schema.min.js')).Schema
                    if (!this.app.types[typeName]) return
                    const valid = this.app.types[typeName].validate(value), errors = valid ? undefined : this.app.types[typeName].errors(value)
                    return { valid, errors }
                },
                'application/x-jsonata': async function (text) {
                    this.app.libraries['application/x-jsonata'] ??= (await import('https://cdn.jsdelivr.net/npm/jsonata@2.0.3/+esm')).default
                    const expression = this.app.libraries['application/x-jsonata'](text)
                    let helperName
                    for (const matches of text.matchAll(this.sys.regexp.jsonataHelpers)) if (((helperName = matches[1]) in this.app.helpers) || (helperName in this.env.helpers)) expression.registerFunction(helperName, (...args) => this.useHelper(helperName, ...args))
                    return expression
                },
                'form': function (obj) {
                    if (!this.isPlainObject(obj)) return {}
                    const formRender = {}
                    for (const k in obj) formRender[`\`[name="${k}"]\``] = obj[k]
                    return formRender
                },
                'xdr': async function (operation, ...args) {
                    this.app.libraries.xdr ??= (await import('https://cdn.jsdelivr.net/gh/cloudouble/simple-xdr/xdr.min.js')).default
                    return this.app.libraries.xdr[operation](...args)
                },
                'text/markdown': async function (text, serialize) {
                    if (!this.app.libraries['text/markdown']) {
                        if (this.app.libraries['text/markdown']) return
                        this.app.libraries['text/markdown'] ||= new (await import('https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm')).Remarkable
                        const plugin = md => md.core.ruler.push('html-components', parser(md, {}), { alt: [] }),
                            parser = md => {
                                return (state) => {
                                    let tokens = state.tokens, i = -1
                                    while (++i < tokens.length) {
                                        const token = tokens[i]
                                        for (const child of (token.children ?? [])) {
                                            if (child.type !== 'text') return
                                            if (this.sys.regexp.isTag.test(child.content)) child.type = 'htmltag'
                                        }
                                    }
                                }
                            }
                        this.app.libraries['text/markdown'].use(plugin)
                        this.app.libraries['text/markdown'].set({ html: true })
                    }
                    const htmlBlocks = (text.match(this.sys.regexp.htmlBlocks) ?? []).map(b => [crypto.randomUUID(), b]),
                        htmlSpans = (text.match(this.sys.regexp.htmlSpans) ?? []).map(b => [crypto.randomUUID(), b])
                    for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
                    for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
                    text = this.app.libraries['text/markdown'].render(text)
                    for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
                    for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
                    return text
                }

            }, types: {}
        }
    },

    expose: { enumerable: true, writable: true, value: false }, // optimal

    Compile: { //optimal
        enumerable: true, value: function () {
            return this.installModule('compile').then(() => {
                for (const [matcher, interpreter] of this.env.interpreters) interpreter.parser = this.modules.compile.parsers[interpreter.name]
            })
        }
    },
    Dev: { //optimal
        enumerable: true, value: function () {
            this.app.facets.exports = new WeakMap()
            return this.installModule('dev').then(() => {
                for (const [p, v = this.modules.dev[p]] of Object.getOwnPropertyNames(this.modules.dev)) if (this.isPlainObject(v)) for (const [pp, vv = v[pp]] in v) if (typeof vv === 'function') v[pp] = vv.bind(this)
            }).then(() => this.modules.dev.console.welcome())
        }
    },
    Expose: { //optimal
        enumerable: true, value: function (name) {
            this.expose = true
            window[name || 'E'] ??= this
        }
    },







    attachUnit: {
        value: async function (unit, unitKey, unitTypeCollectionName, scopeKey, packageUrl, packageKey, pkg) {
            if (!unit) return
            const unitIsString = typeof unit === 'string', unitUrlFromPackage = unitIsString ? (new URL(unit, packageUrl)).href : undefined

            switch (unitTypeCollectionName) {
                case 'components':
                    this.env.namespaces[packageKey] ??= (new URL('../components', packageUrl)).href
                    unitKey = `${packageKey}-${unitKey}`
                case 'facets': case 'gateways': case 'apis': case 'content': case 'models': case 'languages':
                    // create Gateway, API, Anthology, Model and Lexicon classes at the end of this file!
                    return this[scopeKey][unitTypeCollectionName][unitKey] = unitIsString ? unitUrlFromPackage : await unit(this, pkg)
                case 'hooks':
                    return (this.env[unitTypeCollectionName][unitKey] ??= []).push(unitIsString ? unitUrlFromPackage : unit.bind(this, pkg))
                case 'resolvers': case 'transforms':
                    return this[scopeKey][unitTypeCollectionName][unitKey] = unitIsString ? unitUrlFromPackage : unit.bind(this)
                case 'namespaces': case 'libraries':
                    return this[scopeKey][unitTypeCollectionName][unitKey] = unitUrlFromPackage
                case 'patterns':
                    return unitIsString || (unit instanceof RegExp) ? (this[scopeKey][unitTypeCollectionName][unitKey] = new RegExp(unit)) : undefined
                case 'snippets':
                    if (unitIsString) {
                        if (!this.sys.regexp.isHTML(unit)) return this[scopeKey][unitTypeCollectionName][unitKey] = unitUrlFromPackage
                        const template = document.createElement('template')
                        template.innerHTML = unit
                        unit = template
                    }
                    return (unit instanceof HTMLElement) ? (this[scopeKey][unitTypeCollectionName][unitKey] = Object.freeze(unit)) : undefined
                case 'context':
                    return this[scopeKey][unitTypeCollectionName][unitKey] = this.deepFreeze(unit)
                case 'types':
                    switch (typeof unit) {
                        case 'string':
                            return this[scopeKey][unitTypeCollectionName][unitKey] = unit
                        case 'function':
                            if (unit.prototype instanceof this.Validator) return this[scopeKey][unitTypeCollectionName][unitKey] = unit
                            unit = await unit(this, pkg)
                            if (!this.isPlainObject(unit)) return
                        case 'object':
                            return this[scopeKey][unitTypeCollectionName][unitKey] = this.deepFreeze(unit)
                    }




            }


            switch (unitTypeCollectionName) {
                case 'interpreters':
                    if (!(unitTypeCollection instanceof Map)) continue
                    let allValid = true
                    for (const [matcher, interpreter] of unitTypeCollection) {
                        allValid = (matcher instanceof RegExp) && isPlainObject(interpreter)
                            && interpreter.name && (typeof interpreter.name === 'string') && (typeof interpreter.parser === 'function') && (typeof interpreter.handler === 'function')
                            && (!interpreter.binder || (typeof interpreter.binder === 'function'))
                        if (!allValid) break
                        interpreter.name = `${packageKey}-${interpreter.name}`
                    }
                    if (!allValid) continue
                    env.interpreters = new Map([...env.interpreters, ...unitTypeCollection])
                    break
            }
        }
    },

    attachUnitTypeCollection: {
        value: async function (unitTypeCollection, unitTypeCollectionName, packageUrl, packageKey, pkg) {
            const { env, sys, isPlainObject } = this, { unitTypeCollectionChecks } = sys, promises = []
            if (!isPlainObject(unitTypeCollection) || !(unitTypeCollectionName in this.env)) return
            for (const unitKey in unitTypeCollection) {
                if (unitTypeCollectionName === 'resolvers' && !(unitKey in this.env)) continue
                let unit = unitTypeCollection[unitKey], promise
                const attachUnitArgs = [unitKey, unitTypeCollectionName, 'env', packageUrl, packageKey, pkg]
                promise = (unit instanceof Promise) ? unit.then(unit => this.attachUnit(unit, ...attachUnitArgs)) : this.attachUnit(unit, ...attachUnitArgs)
                promises.push(promise)
            }
            await Promise.all(promises)
        }
    },

    ImportPackage: {
        enumerable: true, value: async function (pkg, packageUrl, packageKey) {
            if (!this.isPlainObject(pkg)) return
            if (typeof pkg.hooks?.preInstall === 'function') pkg = (await pkg.hooks.preInstall.bind(this, pkg)()) ?? pkg
            const promises = []
            for (const unitTypeCollectionName in pkg) if (unitTypeCollectionName in this.env) {
                const attachUnitTypeCollectionArgs = [unitTypeCollectionName, packageUrl, packageKey, pkg]
                let unitTypeCollection = pkg[unitTypeCollectionName], promise
                switch (true) {
                    case (typeof unitTypeCollection === 'string'):
                        unitTypeCollection = this.resolveImport(this.resolveUrl(pkg[unitTypeCollectionName], packageUrl), true)
                    case (unitTypeCollection instanceof Promise):
                        promise = unitTypeCollection.then(unitTypeCollection => this.attachUnitTypeCollection(unitTypeCollection, ...attachUnitTypeCollectionArgs))
                        break
                    default:
                        promise = this.attachTypeCollection(unitTypeCollection, ...attachUnitTypeCollectionArgs)
                }
                promises.push(promise)
            }
            await Promise.all(promises)
            if (pkg.hooks?.postInstall === 'function') await pkg.hooks.postInstall.bind(this, pkg)()
        }
    },
    Load: {
        enumerable: true, value: async function (rootElement = undefined, preload = []) {
            if (!rootElement) {
                for (const [, interpreter] of this.env.interpreters) {
                    for (const k in interpreter) if (typeof interpreter[k] === 'function') interpreter[k] = interpreter[k].bind(this)
                    Object.freeze(interpreter)
                }
                this.env.interpreters = Object.freeze(new Proxy(this.env.interpreters, {
                    set: () => { throw new Error('Interpreters are read-only at runtime.') },
                    delete: () => { throw new Error('Interpreters are read-only at runtime.') },
                    clear: () => { throw new Error('Interpreters are read-only at runtime.') },
                    get: (target, prop) => (typeof target[prop] === 'function') ? target[prop].bind(target) : Reflect.get(target, prop)
                }))
                // this.deepFreeze(this.sys)
                // this.deepFreeze(this.env)
                // if (this.modules.dev) {
                //     this.deepFreeze(this.modules.dev)
                // }
                // Object.freeze(this)
                this.processQueue()
            } else {
                await this.activateTag(this.getCustomTag(rootElement), rootElement)
                const isAttr = rootElement.getAttribute('is')
                if (isAttr) {
                    const componentInstance = this.app.components.virtuals.set(rootElement, document.createElement(isAttr)).get(rootElement)
                    for (const a of rootElement.attributes) componentInstance.setAttribute(a.name, a.value)
                    if (rootElement.innerHTML != undefined) componentInstance.innerHTML = rootElement.innerHTML
                    this.app.components.natives.set(componentInstance, rootElement)
                    if (typeof componentInstance.connectedCallback === 'function') componentInstance.connectedCallback()
                    if (componentInstance.disconnectedCallback || componentInstance.adoptedCallback || componentInstance.attributeChangedCallback) {
                        this.app.components.bindings.set(rootElement, new MutationObserver(async records => {
                            for (const record of records) {
                                switch (record.type) {
                                    case 'childList':
                                        for (const removedNode of (record.removedNodes ?? [])) {
                                            if (typeof componentInstance.disconnectedCallback === 'function') componentInstance.disconnectedCallback()
                                            if (typeof componentInstance.adoptedCallback === 'function' && removedNode.ownerDocument !== document) componentInstance.adoptedCallback()
                                        }
                                        break
                                    case 'attributes':
                                        const attrName = record.attributeName, attrOldValue = record.oldValue, attrNewValue = record.target.getAttribute(attrName)
                                        componentInstance.setAttribute(attrName, attrNewValue)
                                        if (typeof componentInstance.attributeChangedCallback === 'function') componentInstance.attributeChangedCallback(attrName, attrOldValue, attrNewValue)
                                        break
                                    case 'characterData':
                                        componentInstance.innerHTML = rootElement.innerHTML
                                        break
                                }
                            }
                        }))
                        this.app.components.bindings.get(rootElement).observe(rootElement, { childList: true, subtree: false, attributes: true, attributeOldValue: true, characterData: true })
                    }
                }
                if (!rootElement.shadowRoot) return
            }
            const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
                observerRoot = rootElement || this.app
            for (const element of domTraverser.call(domRoot, '*')) if (this.isFacetContainer(element)) { this.mountFacet(element) } else if (this.getCustomTag(element)) { this.Load(element) }
            if (!this.app.observers.has(observerRoot)) {
                this.app.observers.set(observerRoot, new MutationObserver(async records => {
                    for (const record of records) {
                        for (const addedNode of (record.addedNodes || [])) {
                            if (this.isFacetContainer(addedNode)) { this.mountFacet(addedNode) } else if (this.getCustomTag(addedNode)) { this.Load(addedNode) }
                            if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.getCustomTag(n)) this.Load(n)
                        }
                        for (const removedNode of (record.removedNodes || [])) {
                            if (typeof removedNode?.querySelectorAll === 'function') for (const n of removedNode.querySelectorAll('*')) if (this.getCustomTag(n)) if (typeof n?.disconnectedCallback === 'function') n.disconnectedCallback()
                            if (this.isFacetContainer(removedNode)) {
                                this.unmountFacet(removedNode)
                            } else if (this.getCustomTag(removedNode) && (typeof removedNode?.disconnectedCallback === 'function')) {
                                removedNode.disconnectedCallback()
                            }
                        }
                    }
                }))
            }
            this.app.observers.get(observerRoot).observe(domRoot, { subtree: true, childList: true })
            if (!rootElement) {
                if (!this.app._globalNamespace) {
                    Object.defineProperty(this.app, '_globalNamespace', { value: undefined, writable: true })
                    const appDescriptors = Object.getOwnPropertyDescriptors(this.app)
                    for (const key in appDescriptors) appDescriptors[key].writable = key === '_globalNamespace'
                    Object.defineProperties(this.app, appDescriptors)
                    Object.seal(this.app)
                }
                this.app.eventTarget.dispatchEvent(new CustomEvent('load', { detail: this }))
                const eventMap = {
                    'beforeinstallprompt': 'installprompt', 'beforeunload': 'unload', 'appinstalled': 'install',
                    'offline': 'offline', 'online': 'online', 'visibilitychange': 'visibilitychange', 'pagehide': 'hide', 'pageshow': 'show'
                }
                for (const n in eventMap) addEventListener(n, event => this.app.eventTarget.dispatchEvent(new CustomEvent(eventMap[n], { detail: this })))
            }
        }
    },

    checkType: {
        enumerable: true, value: async function (typeName, value, validate) {
            if (!(typeName = typeName.trim())) return
            if (!this.app.types[typeName]) {
                let typeDefinition = this.env.types[typeName] ?? typeName
                if (!typeDefinition) return
                if (typeof typeDefinition === 'string') {
                    let isUrl
                    switch (typeDefinition[0]) {
                        case '`':
                            typeDefinition = typeDefinition.slice(1, -1).trim()
                        case '.': case '/':
                            isUrl = true
                            break
                        default:
                            typeDefinition = typeDefinition.trim()
                            if (typeDefinition.includes('://')) try { isUrl = !!new URL(typeDefinition) } catch (e) { }
                            isUrl ??= !((typeDefinition[0] === '{') || typeDefinition.includes(';'))
                            if (isUrl) typeDefinition = `types/${typeDefinition}`
                    }
                    if (isUrl) {
                        const typeSuffixes = ['js', 'wasm', 'schema.json', 'json', 'x']
                        let isType = {}, t, hasSuffix
                        for (t of typeSuffixes) if (hasSuffix ||= isType[t] = typeDefinition.endsWith(`.${t}`)) break
                        if (!hasSuffix) for (t of typeSuffixes) if (isType[t] = (await fetch(`${typeDefinition}.${t}`, { method: 'HEAD' })).ok) break
                        switch (t) {
                            case 'js': case 'wasm':
                                typeDefinition = (await this.getExports(this.resolveUrl(`${typeDefinition}.${t}`))).default
                                break
                            case 'schema.json': case 'json':
                                typeDefinition = await (await fetch(this.resolveUrl(`${typeDefinition}.${t}`))).json()
                                break
                            default:
                                typeDefinition = await (await fetch(this.resolveUrl(t ? `${typeDefinition}.${t}` : typeDefinition))).text()
                        }
                    }
                }
                let isXDR, isJSONSchema
                switch (typeof typeDefinition) {
                    case 'function':
                        this.app.types[typeName] = typeDefinition.bind(this)
                        break
                    case 'object':
                        if (!this.isPlainObject(typeDefinition)) return
                        if (this.isPlainObject(typeDefinition.library) && Array.isArray(typeDefinition.types)) {
                            await this.loadHelper('xdr')
                            typeDefinition = await this.useHelper('xdr', 'import', typeDefinition, undefined, {}, 'json')
                            isXDR = true
                        } else {
                            await this.loadHelper('application/schema+json')
                            typeDefinition = new this.app.libraries['application/schema+json'](typeDefinition)
                            await typeDefinition.deref()
                            isJSONSchema = true
                        }
                        break
                    case 'string':
                        if (typeDefinition[0] === '{') {
                            try { typeDefinition = JSON.parse(typeDefinition) } catch (e) { return }
                            await this.loadHelper('application/schema+json')
                            typeDefinition = new this.app.libraries['application/schema+json'](typeDefinition)
                            await typeDefinition.deref()
                            isJSONSchema = true
                        } else {
                            await this.loadHelper('xdr')
                            typeDefinition = await this.useHelper('xdr', 'factory', typeDefinition, typeName)
                            isXDR = true
                        }
                        break
                }
                switch (true) {
                    case isXDR:
                        this.app.types[typeName] = (function (value, validate) {
                            try {
                                let valid = !!this.app.libraries.xdr.serialize(value, typeDefinition)
                                return validate ? { value, typeName, valid, errors: undefined } : valid
                            } catch (e) {
                                let valid = false
                                return validate ? { value, typeName, valid, errors: e } : valid
                            }
                        }).bind(this)
                        break
                    case isJSONSchema:
                        this.app.types[typeName] = (function (value, validate) {
                            const valid = typeDefinition.validate(value)
                            return validate ? { value, typeName, valid, errors: valid ? undefined : typeDefinition.errors(value) } : valid
                        }).bind(this)
                }
            }
            if (!this.app.types[typeName]) return
            return this.app.types[typeName](value, validate)
        }
    },
    flatten: {
        enumerable: true, value: function (value, key, event) {
            const compile = (plain, complex = []) => {
                return {
                    ...Object.fromEntries(plain.filter(p => value[p] !== undefined).map(p => ([p, value[p]]))),
                    ...Object.fromEntries(complex.filter(p => value[p] !== undefined).map(p => ([p, this.flatten(value[p])])))
                }
            }
            if (value == undefined) return null
            switch (typeof value) {
                case 'string': case 'number': case 'boolean': return value
                case 'bigint': case 'symbol': return value.toString()
                case 'function': return undefined
            }
            if ((value instanceof this.State) || (value instanceof this.Facet)) return this.flatten(value.valueOf())
            if (value instanceof HTMLElement) {
                let result
                const classList = Object.fromEntries(Object.values(value.classList).map(c => [c, true])),
                    style = {}, computedStyle = {}, textContent = value.textContent, innerText = value.innerText
                result = {
                    ...Object.fromEntries(value.getAttributeNames().map(a => ([`@${a}`, value.getAttribute(a)]))),
                    ...Object.fromEntries(Object.entries(compile(['baseURI', 'checked', 'childElementCount', 'className',
                        'clientHeight', 'clientLeft', 'clientTop', 'clientWidth', 'id', 'lang', 'localName', 'name', 'namespaceURI',
                        'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'outerHTML', 'outerText', 'prefix',
                        'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop', 'scrollTopMax', 'scrollWidth',
                        'selected', 'slot', 'tagName', 'title'], []))),
                    textContent, innerText, style, computedStyle, classList, tag: (value.getAttribute('is') || value.tagName).toLowerCase(),
                    '..': textContent, '...': innerText, '#': value.id
                }
                Object.defineProperty(result, 'innerHTML', { enumerable: true, get: () => value.innerHTML })
                Object.defineProperty(result, '<>', { enumerable: true, get: () => value.innerHTML })
                Object.defineProperty(result, '.', {
                    enumerable: true,
                    get: () => {
                        const t = value.textContent
                        return ((t.includes('<') && t.includes('>')) || (t.includes('&') && t.includes(';'))) ? value.innerHTML : t
                    }
                })
                for (const r in value.style) {
                    const ruleValue = value.style.getPropertyValue(r)
                    if (!ruleValue) continue
                    result.style[r] = result[`%${r}`] = ruleValue
                }
                Object.defineProperty(result.computedStyle, '_', { enumerable: false, value: window.getComputedStyle(value) })
                const computedStyleDescriptors = {}, directComputedStyleDescriptors = {}
                for (const s of result.computedStyle._) {
                    computedStyleDescriptors[s] = { enumerable: true, get: () => result.computedStyle._.getPropertyValue(s) }
                    directComputedStyleDescriptors[`&${s}`] = { enumerable: true, get: () => result.computedStyle._.getPropertyValue(s) }
                }
                Object.defineProperties(result.computedStyle, computedStyleDescriptors)
                Object.defineProperties(result, directComputedStyleDescriptors)
                for (const p of ['id', 'name', 'value', 'checked', 'selected']) if (p in value) result[p] = value[p]
                for (const a of ['itemprop', 'class']) if (value.hasAttribute(a)) result[a] = value.getAttribute(a)
                if (value.hasAttribute('itemscope')) result.itemscope = true
                for (const c of Object.keys(classList)) result[`.${c}`] = true
                for (const ent of Object.entries(style)) result[`%${ent[0]}`] = ent[1]
                if (Array.isArray(value.constructor.properties?.flattenable)) for (const p of value.constructor.properties?.flattenable) result[p] = value[p]
                result.dataset = {}
                for (const p in value.dataset) result.dataset[p] = result[`?${p}`] = value.dataset[p]
                result._named = {}
                for (const c of value.querySelectorAll('[name]')) result._named[c.getAttribute('name')] ||= this.flatten(c)._
                result._itemprop = {}
                for (const c of value.querySelectorAll('[itemprop]')) result._itemprop[c.getAttribute('itemprop')] ||= this.flatten(c)._
                if (value.hasAttribute('itemprop')) result['^'] = value.getAttribute('itemprop')
                result.$ = value.value
                result['@'] = value.name
                result._rows = []
                const rows = Array.from(value.querySelectorAll('tr'))
                if (rows.length) {
                    for (const [index, header] of Array.from(rows.shift().querySelectorAll('th')).entries()) {
                        for (const [i, row] of rows.entries()) {
                            result._rows[i - 1] ||= {}
                            const cell = rows[i].querySelectorAll('td')[index]
                            result._rows[i - 1][header.textContent] = this.flatten(cell)._
                        }
                    }
                }
                result._options = []
                if (value.constructor.properties?.value) {
                    result._ = value[value.constructor.properties.value]
                } else if (value.constructor.observedAttributes && value.constructor.observedAttributes.includes('value')) {
                    result._ = value.value
                } else {
                    switch (result.tag) {
                        case 'form': case 'fieldset':
                            result._ = result._named
                            break
                        case 'table':
                            result._ = result._rows
                            break
                        case 'data': case 'meter': case 'input': case 'select': case 'textarea':
                            if (result.tag === 'input') {
                                switch (value.getAttribute('type')) {
                                    case 'checkbox':
                                        result._ = value.checked
                                        break
                                    case 'radio':
                                        result._ = value.selected
                                        break
                                    default:
                                        result._ = value.value
                                }
                            } else {
                                result._ = value.value
                            }
                            break
                        case 'time':
                            result._ = value.getAttribute('datetime')
                            break
                        case 'meta':
                            result._ = value.getAttribute('content')
                            break
                        default:
                            result._ = value.hasAttribute('itemscope') ? result._itemprop : innerText.trim()
                    }
                }
                if (result.tag === 'select' || result.tag === 'datalist') {
                    const options = Array.from(value.querySelectorAll('option')), isObj = options.some(opt => opt.hasAttribute('value'))
                    for (const opt of options) result._options.push(isObj ? [opt.getAttribute('value'), opt.textContent.trim()] : opt.textContent.trim())
                    if (isObj) result._options = Object.fromEntries(result._options)
                    if (result.tag === 'datalist') result._ = result._options
                }
                if (value.parentElement && value.parentElement instanceof HTMLElement) {
                    result._closest = {
                        class: value.parentElement.closest('[class]')?.getAttribute('class'),
                        id: value.parentElement.closest('[id]')?.id,
                        itemprop: value.parentElement.closest('[itemprop]')?.getAttribute('itemprop'),
                        itemscope: this.flatten(value.parentElement.closest('[itemscope]')),
                        name: value.parentElement.closest('[name]')?.name
                    }
                }
                if (event instanceof Event) result._event = this.flatten(event)
                return result
            }
            if (value instanceof Event) {
                return compile(
                    ['bubbles', 'cancelable', 'composed', 'defaultPrevented', 'eventPhase', 'isTrusted', 'timeStamp', 'type',
                        'animationName', 'elapsedTime', 'pseudoElement', 'code', 'reason', 'wasClean', 'data',
                        'acceleration', 'accelerationIncludingGravity', 'interval', 'rotationRate',
                        'absolute', 'alpha', 'beta', 'gamma', 'message', 'filename', 'lineno', 'colno',
                        'clientId', 'replacesClientId', 'resultingClientId', 'newURL', 'oldURL', 'newVersion', 'oldVersion',
                        'inputType', 'isComposing', 'altKey', 'code', 'ctrlKey', 'isComposing', 'key', 'location', 'metaKey', 'repeat', 'shiftKey',
                        'lastEventId', 'origin', 'button', 'buttons', 'clientX', 'clientY', 'ctrlKey', 'metaKey', 'movementX', 'movementY',
                        'offsetX', 'offsetY', 'pageX', 'pageY', 'screenX', 'screenY', 'shiftKey', 'x', 'y', 'persisted',
                        'height', 'isPrimary', 'pointerId', 'pointerType', 'pressure', 'tangentialPressure', 'tiltX', 'tiltY', 'twist', 'width',
                        'state', 'lengthComputable', 'loaded', 'total', 'key', 'newValue', 'oldValue', 'url', 'propertyName', 'detail', 'statusMessage',
                        'deltaX', 'deltaY', 'deltaZ'
                    ],
                    ['currentTarget', 'target', 'data', 'clipboardData', 'detail', 'dataTransfer', 'relatedTarget', 'formData', 'submitter']
                )
            }
            if (value instanceof Blob) return compile(['size', 'type'])
            if (value instanceof DataTransfer) return compile(['dropEffect', 'effectAllowed', 'types'])
            if (value instanceof FormData) return Object.fromEntries(value.entries())
            if (value instanceof Response) return { body: this.parse(value), ok: value.ok, status: value.status, headers: Object.fromEntries(value.headers.entries()) }
            if (Array.isArray(value)) return value.map(e => this.flatten(e, key))
            if (this.isPlainObject(value)) {
                const result = {}
                for (const k in value) result[`${k}`] = this.flatten(value[k])
                return result
            }
            if (value instanceof Object) return (value.valueOf ?? (() => undefined))()
        }
    },
    generateUuid: {//optimal
        enumerable: true, value: function (noDashes) {
            if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()[noDashes ? 'replace' : 'toString'](this.sys.regexp.dash, '')
            return (noDashes ? 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx' : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(this.sys.regexp.xy, c => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4 + 8)) | 0).toString(16))
        }
    },
    isFacetContainer: {
        enumerable: true, value: function (element) {
            return ((element instanceof HTMLScriptElement) && (element.type === 'directives/element' || element.type === 'facet/element' || element.type === 'application/element'))
        }
    },
    isPlainObject: { // optimal
        enumerable: true, value: function (obj) {
            if (!obj) return false
            const proto = Object.getPrototypeOf(obj)
            return proto === null || proto === Object.prototype || proto.constructor === Object
        }
    },
    loadHelper: {
        enumerable: true, value: async function (name) {
            if (typeof this.app.helpers[name] === 'function') return name
            if (typeof this.env.loaders[name] === 'function') await this.env.loaders[name]()
            if (typeof this.env.helpers[name] === 'function') return ((this.app.helpers[name] = this.env.helpers[name]) && name)
        }
    },
    parse: {
        enumerable: true, value: async function (input, contentType) {
            const typeCheck = (input instanceof Response) || (typeof input === 'text')
            if (!typeCheck && (input instanceof Object)) return input
            input = typeCheck ? input : `${input}`
            let inputUrlExtension
            if (!contentType) {
                if (!contentType && (input instanceof Response)) {
                    contentType ||= input.url.endsWith('.html') ? 'text/html' : undefined
                    contentType ||= input.url.endsWith('.css') ? 'text/css' : undefined
                    contentType ||= input.url.endsWith('.md') ? 'text/markdown' : undefined
                    contentType ||= input.url.endsWith('.csv') ? 'text/csv' : undefined
                    contentType ||= input.url.endsWith('.txt') ? 'text/plain' : undefined
                    contentType ||= input.url.endsWith('.json') ? 'application/json' : undefined
                    contentType ||= input.url.endsWith('.yaml') ? 'application/x-yaml' : undefined
                    contentType ||= input.url.endsWith('.jsonl') ? 'application/x-jsonl' : undefined
                    contentType ||= input.url.endsWith('.hjson') ? 'application/hjson' : undefined
                    const serverContentType = input.headers.get('Content-Type')
                    if (serverContentType !== 'application/octet-stream') contentType ||= serverContentType || undefined
                    if (input.url.includes('.')) inputUrlExtension = input.url.split('.').pop()
                } else if (contentType && contentType.includes('json')) {
                    contentType = 'application/json'
                } else if (contentType && contentType.includes('yaml')) {
                    contentType = 'application/x-yaml'
                } else if (contentType && contentType.includes('csv')) {
                    contentType = 'text/csv'
                }
                contentType ||= 'application/json'
            }
            if (!contentType.includes('/')) contentType = `application/${contentType}`
            if ((contentType === 'text/html') || (contentType === 'text/plain')) return (input instanceof Response) ? await input.text() : input
            if (contentType.includes('application/json')) return (input instanceof Response) ? await input.json() : JSON.parse(input)
            let text = ((input instanceof Response) ? await input.text() : input).trim()
            if (contentType === 'text/css') return await (new CSSStyleSheet()).replace(text)
            if (contentType && contentType.includes('form')) return Object.fromEntries((new URLSearchParams(text)).entries())
            let hasHelper = await this.loadHelper(contentType)
            if (hasHelper) return this.useHelper(contentType, text) ?? text
            if (inputUrlExtension) {
                inputUrlExtension = `.${inputUrlExtension}`
                hasHelper = await this.loadHelper(inputUrlExtension)
                if (hasHelper) return this.useHelper(inputUrlExtension, text) ?? text
            }
        }
    },
    render: {
        enumerable: true, value: async function (element, data) {
            const isElement = element instanceof HTMLElement, isFragment = element instanceof DocumentFragment
            if (!(isElement || (isFragment && (typeof data === 'object')))) return
            if (data === null) return
            let tag
            if (isElement) {
                element = this.app.components.natives.get(element) ?? element
                tag = (element.getAttribute('is') || element.tagName).toLowerCase()
                if (typeof data !== 'object') {
                    if (element.constructor.properties?.value) {
                        try { return element[element.constructor.properties.value] = data } catch (e) { return }
                    } else if (element.constructor.observedAttributes && element.constructor.observedAttributes.includes('value')) {
                        try { return element.value = data } catch (e) { return }
                    } else {
                        switch (tag) {
                            case 'meta':
                                return data == undefined ? element.removeAttribute('content') : element.setAttribute('content', data)
                            case 'data': case 'input': case 'meter': case 'select': case 'textarea':
                                return element.value = data
                            case 'audio': case 'embed': case 'iframe': case 'img': case 'source': case 'track': case 'video':
                                return data == undefined ? element.removeAttribute('src') : element.setAttribute('src', data)
                            case 'area': case 'link':
                                return data == undefined ? element.removeAttribute('href') : element.setAttribute('href', data)
                            case 'object':
                                return data == undefined ? element.removeAttribute('data') : element.setAttribute('data', data)
                            default:
                                if (typeof data === 'string') return element[
                                    ((data.includes('<') && data.includes('>')) || (data.includes('&') && data.includes(';'))) ? 'innerHTML' : 'textContent'
                                ] = data
                                return element.textContent = (data == undefined) ? '' : data
                        }
                    }
                }
            }
            const setProperty = (k, v, element) => {
                if (v === undefined) try { return delete element[k] } catch (e) { return }
                if (k.includes('(') && k.endsWith(')')) return this.runElementMethod(k, v, element)
                element[k] = v
            }
            const snippetUsageCounter = {}
            for (const [k, v] of Object.entries(data)) {
                if (!k || (isFragment && k[0] !== '`')) continue
                switch (k[0]) {
                    case '#':
                        if (k === '#') { element.setAttribute('id', v); continue }
                        if (k.charCodeAt(1) >= 65 && k.charCodeAt(1) <= 90) {
                            element[`aria${k.slice(1)}`] = v
                        } else {
                            element.setAttribute(`aria-${k.slice(1)}`, v)
                        }
                    case '%':
                        const styleRule = k.slice(1)
                        if (!styleRule) continue
                        element.style[v === null ? 'removeProperty' : 'setProperty'](styleRule, v)
                        continue
                    case '@':
                        if (k === '@') {
                            element.name = v;
                            continue
                        }
                        const attrName = k.slice(1) || 'name'
                        switch (v) {
                            case true: case false:
                                element.toggleAttribute(attrName, v)
                                continue
                            case null: case undefined:
                                element.removeAttribute(attrName)
                                continue
                            default:
                                element.setAttribute(attrName, v)
                                continue
                        }
                    case '$':
                        if (k === '$') {
                            element.value = v
                            continue
                        } else if (v == undefined) {
                            delete element.dataset[k.slice(1)]
                        } else {
                            element.dataset[k.slice(1)] = v
                        }
                        continue
                    case '!':
                        let eventName = k.slice(1)
                        if (!eventName) eventName = element.constructor.events?.default ?? this.sys.defaultEventTypes[tag] ?? 'click'
                        if (v != null) {
                            const eventOptions = (typeof v === 'object' && ('bubbles' in v || 'cancelable' in v || 'detail' in v)) ? v : { detail: v, bubbles: true, cancelable: true }
                            element.dispatchEvent(new CustomEvent(eventName, eventOptions))
                        }
                        continue
                    case '.': case '<':
                        switch (k) {
                            case '<>':
                                if (!v) { element.replaceChildren(); continue }
                                element.innerHTML = v
                                continue
                            case '.':
                                if (!v) { element.replaceChildren(); continue }
                                element[v.includes('<') && v.includes('>') ? 'innerHTML' : 'textContent'] = v
                                continue
                            case '..':
                                if (!v) { element.replaceChildren(); continue }
                                element.textContent = v
                                continue
                            case '...':
                                if (!v) { element.replaceChildren(); continue }
                                element.innerText = v
                                continue
                            default:
                                if (k[0] === '<' && k.slice(-1) === '>') {
                                    if (v === false) continue
                                    let renderExpression = k.slice(1, -1).trim(), insertSelector, insertPosition
                                    if (renderExpression.includes('::')) [renderExpression, insertPosition] = renderExpression.split('::').map(s => s.trim())
                                    if (insertPosition && insertPosition.includes('|')) [insertPosition, insertSelector] = insertPosition.split('|', 2).map(s => s.trim())
                                    const snippetUsageCounterIndex = insertSelector || ':scope'
                                    if (insertPosition && !(insertPosition in this.sys.insertPositions)) insertPosition = undefined
                                    if (!insertPosition) insertPosition = snippetUsageCounter[snippetUsageCounterIndex] ? 'append' : (['html', 'head', 'body'].includes(tag) ? 'append' : 'replaceChildren')
                                    snippetUsageCounter[snippetUsageCounterIndex] = snippetUsageCounter[snippetUsageCounterIndex] ? (snippetUsageCounter[snippetUsageCounterIndex] + 1) : 1
                                    if (renderExpression[0] === '&' && renderExpression.slice(-1) === '&') {
                                        renderExpression = renderExpression.slice(1, -1)
                                        let useSnippet
                                        if (renderExpression[0] === '`' && renderExpression.slice(-1) === '`') {
                                            renderExpression = renderExpression.slice(1, -1)
                                            if (this.app.snippets[renderExpression] === true) {
                                                let waitCount = 0
                                                while ((waitCount <= 100) && (this.app.snippets[renderExpression] === true)) await new Promise(resolve => requestIdleCallback
                                                    ? requestIdleCallback(resolve, { timeout: 100 }) : setTimeout(resolve, 100))
                                            }
                                            if (this.app.snippets[renderExpression] === true) delete this.app.snippets[renderExpression]
                                            if (this.app.snippets[renderExpression] && (this.app.snippets[renderExpression] instanceof HTMLTemplateElement)) {
                                                useSnippet = this.app.snippets[renderExpression]
                                            } else if (this.env.snippets[renderExpression]) {
                                                this.app.snippets[renderExpression] = true
                                                const envSnippet = this.env.snippets[renderExpression]
                                                useSnippet = document.createElement('template')
                                                if (envSnippet instanceof HTMLElement) {
                                                    useSnippet = envSnippet.cloneNode(true)
                                                } else if (typeof envSnippet === 'string') {
                                                    if (envSnippet[0] === '`' && envSnippet.endsWith('`')) {
                                                        let snippetUrl = this.resolveSnippetKey(envSnippet)
                                                        useSnippet.innerHTML = await (await fetch(this.resolveUrl(snippetUrl))).text()
                                                    } else {
                                                        useSnippet.innerHTML = envSnippet
                                                    }
                                                }
                                            } else {
                                                this.app.snippets[renderExpression] = true
                                                useSnippet = document.createElement('template')
                                                let snippetUrl = renderExpression
                                                snippetUrl = this.resolveSnippetKey('`' + snippetUrl + '`')
                                                useSnippet.innerHTML = await (await fetch(this.resolveUrl(snippetUrl))).text()
                                            }
                                            this.app.snippets[renderExpression] = useSnippet
                                        } else {
                                            useSnippet = this.resolveScopedSelector(renderExpression, element)
                                        }
                                        if (useSnippet) this.renderWithSnippet(element, v, useSnippet, insertPosition, insertSelector)
                                        continue
                                    }
                                    const tagMatch = renderExpression.match(this.sys.regexp.tagMatch) ?? [],
                                        idMatch = renderExpression.match(this.sys.regexp.idMatch) ?? [], classMatch = renderExpression.match(this.sys.regexp.classMatch) ?? [],
                                        attrMatch = renderExpression.match(this.sys.regexp.attrMatch) ?? []
                                    this.renderWithSnippet(element, v, tagMatch[0], insertPosition, insertSelector, (idMatch[0] ?? '').slice(1),
                                        (classMatch[0] ?? '').slice(1).split('.').map(s => s.trim()).filter(s => !!s),
                                        Object.fromEntries((attrMatch ?? []).map(m => m.slice(1, -1)).map(m => m.split('=').map(ss => ss.trim())))
                                    )
                                    continue
                                } else if (k[0] === '.' && k.length > 1 && k[1] !== '.') {
                                    const className = k.slice(1)
                                    if (!className) continue
                                    element.classList.toggle(className, v)
                                    continue
                                }
                        }
                    case '`':
                        let nestingTargets = this.resolveScopedSelector(k.slice(1, -1), element)
                        if (!nestingTargets) continue
                        if (!Array.isArray(nestingTargets)) nestingTargets = [nestingTargets]
                        await Promise.all(nestingTargets.map(t => this.render(t, v)))
                        continue
                    case '^':
                        if (element.hasAttribute('itemscope')) {
                            this.render(element.querySelector(`[itemprop="${k.slice(1)}"]`), v)
                            break
                        } else {
                            element.setAttribute(`itemprop`, k.slice(1))
                        }
                    default:
                        setProperty(k, v, element)
                }
            }
        },
    },
    resolveScope: {
        enumerable: true, value: function (scopeStatement, element) {
            element = this.app.components.natives.get(element) ?? element
            if (!scopeStatement) return element.parentElement
            switch (scopeStatement) {
                case 'head': return document.head
                case 'body': return document.body
                case '^': case '~':
                    let root = element.getRootNode()
                    return (root instanceof ShadowRoot) ? root : (scopeStatement === '~' ? document.head : document.body)
                case 'root':
                    return element.getRootNode()
                case 'host':
                    return element.getRootNode().host ?? document.documentElement
                case '*':
                    let scope = element.getRootNode()
                    return (scope === document) ? document.documentElement : scope
                case 'documentElement': case 'html': return document.documentElement
                case 'document': return document
                case 'window': return window
                default:
                    return element.closest(scopeStatement)
            }
        }
    },
    resolveScopedSelector: {
        enumerable: true, value: function (scopedSelector, element) {
            if (element) element = this.app.components.natives.get(element) ?? element
            if (this.sys.impliedScopes[scopedSelector]) return element ? this.resolveScope(this.sys.impliedScopes[scopedSelector], element) : { scope: this.sys.impliedScopes[scopedSelector] }
            if (this.sys.impliedScopes[scopedSelector[0]]) scopedSelector = `${this.sys.impliedScopes[scopedSelector[0]]}|${scopedSelector}`
            let scope = element
            if (this.sys.regexp.pipeSplitter.test(scopedSelector)) {
                const [scopeStatement, selectorStatement] = scopedSelector.split(this.sys.regexp.pipeSplitter, 2).map(s => s.trim())
                if (!element) return { scope: scopeStatement, selector: selectorStatement }
                scope = this.resolveScope(scopeStatement, element)
                scopedSelector = selectorStatement
            }
            return element ? this.resolveSelector(scopedSelector, scope) : { selector: scopedSelector }
        }
    },
    resolveSelector: {
        enumerable: true, value: function (selector, scope) {
            if (!selector) return scope
            if (selector[0] === ':') return scope.querySelector(this.buildCatchallSelector(selector))
            let sliceSignature
            const lastIndexOfOpenCurlyBracket = selector.lastIndexOf('{'), isMulti = (lastIndexOfOpenCurlyBracket > 0) && selector.endsWith('}')
            if (isMulti) [selector, sliceSignature] = [selector.slice(0, lastIndexOfOpenCurlyBracket), selector.slice(lastIndexOfOpenCurlyBracket + 1, -1)]
            try {
                return isMulti ? this.sliceAndStep(sliceSignature, Array.from(scope.querySelectorAll(selector))) : scope.querySelector(selector)
            } catch (e) {
                const matches = [], branches = selector.split(this.sys.regexp.selectorBranchSplitter)
                for (const branch of branches) {
                    const branchMatches = []
                    try {
                        branchMatches.push(...(isMulti ? Array.from(scope.querySelectorAll(branch)) : [scope.querySelector(branch)].filter(n => !!n)))
                    } catch (ee) {
                        const segments = branch.split(this.sys.regexp.selectorSegmentSplitter)
                        let segmentTracks = [scope]
                        for (const segment of segments) {
                            const newTracks = []
                            for (const track of segmentTracks) {
                                try {
                                    newTracks.push(...Array.from(track.querySelectorAll(`:scope ${segment}`)))
                                } catch (eee) {
                                    const hasNonDefaultCombinator = ((segment[0] === '|') || (segment[0] in this.sys.selector.combinators))
                                    let nonDefaultCombinator = hasNonDefaultCombinator ? (segment[0] === '|' ? '||' : segment[0]) : '', combinatorProcessor = this.sys.selector.combinators[nonDefaultCombinator],
                                        qualified = combinatorProcessor(track), remainingSegment = segment.slice(nonDefaultCombinator.length).trim()
                                    while (remainingSegment) {
                                        let indexOfNextClause = -1, writeIndex = 0
                                        if (remainingSegment[0] === '[') {
                                            indexOfNextClause = remainingSegment.indexOf(']', 1) + 1
                                        } else {
                                            for (const c in this.sys.selector.clauseOpeners) if ((indexOfNextClause = remainingSegment.indexOf(c, 1)) !== -1) break
                                        }
                                        const noIndexOfNextClause = indexOfNextClause === -1, thisClause = remainingSegment.slice(0, noIndexOfNextClause ? undefined : indexOfNextClause).trim()
                                        try {
                                            for (let i = 0; i < qualified.length; i++) if (qualified[i].matches(thisClause)) qualified[writeIndex++] = qualified[i]
                                        } catch (eeee) {
                                            const clauseOpener = thisClause[0]
                                            switch (clauseOpener) {
                                                case '@': case '!': case '^': case '$':
                                                    const clauseMain = thisClause.slice(1)
                                                    for (let i = 0; i < qualified.length; i++) if (this.sys.selector.clauseOpeners[clauseOpener](qualified[i], clauseMain)) qualified[writeIndex++] = qualified[i]
                                                    break
                                                case '[':
                                                    let indexOfComparator, clauseComparator, clauseInputValueType
                                                    for (clauseComparator in this.sys.selector.comparators) if ((indexOfComparator = thisClause.indexOf(clauseComparator, 1)) !== -1) break
                                                    const comparatorProcessor = this.sys.selector.comparators[clauseComparator],
                                                        clauseKey = clauseComparator ? thisClause.slice(1, indexOfComparator).trim() : thisClause.slice(1, -1)
                                                    let clauseReferenceValue = clauseComparator ? thisClause.slice(indexOfComparator + clauseComparator.length, -1).trim() : undefined
                                                    if (clauseReferenceValue && (clauseReferenceValue.length > 1) && (clauseReferenceValue[0] == '"' || clauseReferenceValue[0] == "'") && (clauseReferenceValue.endsWith('"') || clauseReferenceValue.endsWith("'"))) clauseReferenceValue = clauseReferenceValue.slice(1, -1)
                                                    switch (clauseKey) {
                                                        case '...':
                                                            clauseInputValueType = 'textContent'
                                                        case '..':
                                                            clauseInputValueType ??= 'innerText'
                                                        case '<>':
                                                            clauseInputValueType ??= 'innerHTML'
                                                            for (let i = 0; i < qualified.length; i++) if (comparatorProcessor(qualified[i][clauseInputValueType], clauseReferenceValue)) qualified[writeIndex++] = qualified[i]
                                                            break
                                                        case '.':
                                                            for (let i = 0, n = qualified[i], tc = n.textContent; i < qualified.length; i++) if (comparatorProcessor(this.sys.isHTML.test(tc = (n = qualified[i]).textContent) ? n.innerHTML : tc, clauseReferenceValue)) qualified[writeIndex++] = n
                                                            break
                                                        default:
                                                            const clauseFlag = clauseKey[0] in this.sys.selector.flags ? clauseKey[0] : '', clauseProperty = clauseKey.slice(clauseFlag.length)
                                                            for (let i = 0, n = qualified[i]; i < qualified.length; i++) if (comparatorProcessor(this.sys.selector.flags[clauseFlag](n = qualified[i], clauseProperty), clauseReferenceValue, clauseFlag, clauseProperty)) qualified[writeIndex++] = n
                                                    }
                                            }
                                        }
                                        qualified.length = writeIndex
                                        if (!qualified.length) break
                                        remainingSegment = remainingSegment.slice(thisClause.length)
                                    }
                                    newTracks.push(...qualified)
                                }
                            }
                            segmentTracks = newTracks
                        }
                        branchMatches.push(...segmentTracks)
                    }
                    if (!branchMatches.length) continue
                    if (!isMulti) return branchMatches[0]
                    matches.push(...branchMatches)
                }
                return isMulti ? this.sliceAndStep(sliceSignature, matches) : matches[0]
            }
        }
    },
    resolveUrl: { // optimal
        enumerable: true, value: function (value, base, raw) {
            if (typeof value !== 'string') return value
            base ??= document.baseURI
            const valueUrl = new URL(value, base), { protocol } = valueUrl
            if (protocol === document.location.protocol) return raw ? valueUrl : valueUrl.href
            const gateway = this.app.gateways[protocol]
            if (gateway) {
                const path = valueUrl.pathname.replace(this.sys.regexp.leadingSlash, '')
                switch (typeof gateway) {
                    case 'function':
                        const gatewayArgs = { path }
                        for (const k in valueUrl) if (typeof valueUrl[k] === 'string') gatewayArgs[k] = valueUrl[k]
                        return raw ? new URL((gateway(gatewayArgs)), base) : (gateway(gatewayArgs))
                    case 'string':
                        const mergedUrl = new URL(gateway.replace(this.sys.regexp.gatewayUrlTemplateMergeField, (match, mergeExpression) => {
                            mergeExpression = mergeExpression.trim()
                            if (!mergeExpression) return path
                            if (!mergeExpression.includes('|')) {
                                if (!mergeExpression.includes(':')) return valueUrl[mergeExpression] ?? path
                                mergeExpression = `path|/|${mergeExpression}`
                            }
                            const [part = 'path', delimiter = ((part === 'host' || part === 'hostname') ? '.' : '/'), sliceAndStepSignature = '0', joinChar = delimiter] = mergeExpression.split('|')
                            return this.sliceAndStep(sliceAndStepSignature, (valueUrl[part] ?? path).split(delimiter)).join(joinChar)
                        }), base)
                        return raw ? mergedUrl : mergedUrl.href
                }
            }
            return raw ? valueUrl : valueUrl.href
        }
    },

    resolveShape: {
        enumerable: true, value: function (input) {
            const parseInput = (input) => {
                if (typeof input !== 'string') return input
                if (input.startsWith('[')) {
                    return parseArray(input);
                } else if (input.startsWith('?')) {
                    return parseQuerystring(input);
                } else if (input.startsWith('{')) {
                    return parseObject(input);
                }
                return input
            }, parseArray = (input) => {
                input = input.slice(1, -1); // Strip the []
                const entries = splitIgnoringNesting(input, ',', ['"', "'", '[', ']', '{', '}']);
                return entries.map(entry => parseInput(entry.trim()));
            }, parseQuerystring = (input) => {
                input = input.slice(1); // Strip the ?
                const result = {};
                const entries = splitIgnoringNesting(input, '&', ['"', "'"]);
                for (const entry of entries) {
                    const [rawKey, rawValue] = splitByFirstIgnoringNesting(entry, '=', ['"', "'"]);
                    let key = rawKey.trim();
                    let value = rawValue !== undefined ? rawValue.trim() : undefined;

                    if (value === undefined) {
                        [key, value] = handleImplicitValue(key);
                    }

                    result[key] = value;
                }
                return result;
            }, parseObject = (input) => {
                input = input.slice(1, -1); // Strip the {}
                const result = {};
                const entries = splitIgnoringNesting(input, ',', ['"', "'", '[', ']', '{', '}']);
                for (const entry of entries) {
                    const [rawKey, rawValue] = splitByFirstIgnoringNesting(entry, ':', ['"', "'", '[', ']', '{', '}']);
                    let key = rawKey.trim();
                    let value = rawValue !== undefined ? rawValue.trim() : undefined;

                    if (value === undefined) {
                        [key, value] = handleImplicitValue(key);
                    } else {
                        value = parseInput(value);
                    }

                    result[key] = value;
                }
                return result;
            }, splitIgnoringNesting = (input, delimiter, nesters) => {
                const result = [];
                let current = '';
                let depth = 0;
                let inQuote = null;

                for (let i = 0; i < input.length; i++) {
                    const char = input[i];

                    if (inQuote) {
                        current += char;
                        if (char === inQuote) inQuote = null; // Close quote
                    } else {
                        if (char === '"' || char === "'") {
                            inQuote = char; // Open quote
                            current += char;
                        } else if (nesters.includes(char)) {
                            depth += 1;
                            current += char;
                        } else if (nesters.includes(getMatchingCloser(char))) {
                            depth -= 1;
                            current += char;
                        } else if (char === delimiter && depth === 0) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                }

                if (current) result.push(current.trim());

                return result;
            }, splitByFirstIgnoringNesting = (input, delimiter, nesters) => {
                let current = '';
                let depth = 0;
                let inQuote = null;

                for (let i = 0; i < input.length; i++) {
                    const char = input[i];

                    if (inQuote) {
                        current += char;
                        if (char === inQuote) inQuote = null; // Close quote
                    } else {
                        if (char === '"' || char === "'") {
                            inQuote = char; // Open quote
                            current += char;
                        } else if (nesters.includes(char)) {
                            depth += 1;
                            current += char;
                        } else if (nesters.includes(getMatchingCloser(char))) {
                            depth -= 1;
                            current += char;
                        } else if (char === delimiter && depth === 0) {
                            const rest = input.slice(i + 1);
                            return [current.trim(), rest.trim()];
                        } else {
                            current += char;
                        }
                    }
                }

                return [current.trim()];
            }, handleImplicitValue = (key) => {
                if (key.endsWith('.')) return [key.slice(0, -1), true];
                if (key.endsWith('!')) return [key.slice(0, -1), false];
                if (key.endsWith('-')) return [key.slice(0, -1), null];
                if (key.endsWith('?')) return [key.slice(0, -1), undefined];
                return [key, key]; // Implicitly set value to the key itself
            }, getMatchingCloser = (char) => {
                if (char === '[') return ']';
                if (char === '{') return '}';
                return null;
            }, skipWhitespace = (input, i) => {
                while (i < input.length && /\s/.test(input[i])) i++;
                return i;
            }

            return parseInput(input)

        }
    },



    resolveVariable: {
        enumerable: true, value: function (expression, flags, envelope = {}) {
            let result = expression, { wrapped, default: dft, spread } = (flags ?? {})
            switch (true) {
                case typeof expression === 'string':
                    expression = expression.trim()
                    wrapped ??= ((expression[0] === '$') && (expression[1] === '{') && (expression.endsWith('}')))
                    if (wrapped) expression = expression.slice(2, -1).trim()
                    const { context, cells, fields, labels, value } = envelope, e0 = expression[0], entries = []
                    let expressionIsArray, u
                    switch (true) {
                        case (expression in this.sys.valueAliases):
                            result = this.sys.valueAliases[expression]
                            break
                        case (expression === '$'):
                            result = 'value' in envelope ? value : expression
                            break
                        case (e0 === '$'): case (e0 === '@'): case (e0 === '#'): case (e0 === '~'):
                            const subEnvelope = { '$': labels, '@': fields, '#': cells, '~': context }[e0]
                            switch (undefined) {
                                case subEnvelope:
                                    result = expression
                                    break
                                default:
                                    const [mainExpression, ...vectors] = expression.split('.'), l = vectors.length
                                    let i = 0
                                    result = subEnvelope[mainExpression.slice(1)]
                                    while (result !== undefined && i < l) result = result?.[vectors[i++]]
                            }
                            break
                        case (e0 === '?'):
                        case ((e0 === '{') && expression.endsWith('}')):
                        case ((e0 === '{') && expression.endsWith('}')):
                            result = this.resolveShape(expression)
                            if (context || cells || fields || labels || ('value' in envelope)) {
                                flags.wrapped = false
                                result = this.resolveVariable(expression, flags, envelope)
                            }
                            break
                        case ((e0 === '"') && expression.endsWith('"')):
                        case ((e0 === "'") && expression.endsWith("'")):
                            result = expression.slice(1, -1)
                            break
                        case (this.sys.regexp.isNumeric.test(expression)):
                            result = expression % 1 === 0 ? parseInt(expression, 10) : parseFloat(expression)
                            break
                        default:
                            result = expression
                    }
                    break
                case Array.isArray(expression):
                    result = []
                    for (let i = 0, l = expression.length, a = spread && Array.isArray(dft); i < l; i++)
                        result.push(this.resolveVariable(expression[i], { inner: true, default: a ? dft[i] : dft }, envelope))
                    break
                case this.isPlainObject(expression):
                    result = {}
                    const dftIsObject = spread && this.isPlainObject(dft)
                    for (const key in expression) {
                        let keyFlags = { wrapped: false, default: dftIsObject ? dft[key] : dft }
                        result[this.resolveVariable(key, envelope, keyFlags)] = this.resolveVariable(expression[key], keyFlags, envelope)
                    }
            }
            return result === undefined ? dft : result
        }
    },


    runTransform: {
        enumerable: true, value: async function (transform, data = {}, element = undefined, variableMap = {}) {
            if (transform) transform = transform.trim()
            const transformKey = transform
            let expression, helperAlias
            if (this.app.transforms[transformKey] === true) {
                let waitCount = 0
                while ((waitCount <= 100) && (this.app.transforms[transformKey] === true)) await new Promise(r => globalThis.requestIdleCallback ? globalThis.requestIdleCallback(r, { timeout: 100 }) : setTimeout(r, 100))
            }
            if (this.app.transforms[transformKey] === true) delete this.app.transforms[transformKey]
            if (!this.app.transforms[transformKey]) {
                this.app.transforms[transformKey] = true
                resolveBackticks: {
                    if (transformKey[0] === '`') {
                        if (transformKey.endsWith(')`') && transformKey.includes('(')) return this.runFragmentAsMethod(transformKey.slice(1, -1), data)
                        if (this.env.transforms[transformKey]) {
                            [transform, expression] = [transformKey, this.env.transforms[transformKey]]
                            break resolveBackticks
                        }
                        let transformUrl = transformKey.slice(1, -1).trim(), functionName = 'default', isJSONata, isJS, isWASM
                        const usesSubFunction = transformUrl.includes('|'), isRemote = transformUrl.includes('://'),
                            isJsOrWasm = usesSubFunction || (isJS = transformUrl.endsWith('.js')) || (isWASM = transformUrl.endsWith('.wasm'))
                        if (usesSubFunction) [transformUrl, functionName] = transformUrl.split('|')
                        if (isRemote) {
                            transformUrl = this.resolveUrl(transformUrl);
                            [transform, expression] = isJsOrWasm ? [transform, (await this.getExports(transformUrl))[functionName]]
                                : [await fetch(transformUrl).then(r => r.text()), undefined]
                            break resolveBackticks
                        }
                        if (!this.sys.regexp.isLocalUrl.test(transformUrl)) transformUrl = `transforms/${transformUrl}`
                        if (isJsOrWasm) {
                            isJS ??= transformUrl.endsWith('.js')
                            isWASM ??= transformUrl.endsWith('.wasm')
                        } else {
                            isJSONata = transformUrl.endsWith('.jsonata')
                        }
                        if (isJS || isWASM || isJSONata) {
                            transformUrl = this.resolveUrl(transformUrl);
                            [transform, expression] = isJsOrWasm ? [transform, (await this.getExports(transformUrl))[functionName]]
                                : [await fetch(transformUrl).then(r => r.text()), undefined]
                            break resolveBackticks
                        }
                        let checkURL = this.resolveUrl(`${transformUrl}.js`)
                        isJS = (await fetch(checkURL, { method: 'HEAD' })).ok
                        if (isJS) {
                            [transform, expression] = [transform, (await this.getExports(checkURL))[functionName]]
                            break resolveBackticks
                        }
                        checkURL = this.resolveUrl(`${transformUrl}.wasm`)
                        isWASM = (await fetch(checkURL, { method: 'HEAD' })).ok
                        if (isWASM) {
                            [transform, expression] = [transform, (await this.getExports(checkURL))[functionName]]
                            break resolveBackticks
                        }
                        checkURL = this.resolveUrl(`${transformUrl}.jsonata`)
                        [transform, expression] = [await fetch(checkURL).then(r => r.text()), undefined]
                        break resolveBackticks
                    }
                }
                if (!transform) {
                    delete this.app.transforms[transformKey]
                    return
                }
                expression ||= this.env.transforms[transformKey]
                if (!expression) expression = this.useHelper(await this.loadHelper('application/x-jsonata'), transform)
                this.app.transforms[transformKey] = [transform, expression]
            } else {
                if (transformKey[0] === '`') [transform, expression] = this.app.transforms[transformKey]
                if (!transform) return
            }
            expression ||= this.app.transforms[transformKey][1]
            const bindings = {}, isFunc = typeof expression === 'function'
            if (element) {
                if (isFunc || transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)
                if (isFunc || transform.includes('$this')) bindings.this = this.flatten(element)
                if (isFunc || transform.includes('$root')) bindings.root = this.flatten((this.app.components.natives.get(element) ?? element).getRootNode())
                if (isFunc || transform.includes('$host')) bindings.host = this.flatten((this.app.components.natives.get(element) ?? element).getRootNode().host)
                if (isFunc || transform.includes('$document')) bindings.document = { ...this.flatten(document.documentElement), ...this.flatten(document) }
            }
            for (const [k, v] of Object.entries(variableMap)) if (isFunc || transform.includes(`$${k}`)) bindings[k] = typeof v === 'function' ? v : this.flatten(v)
            if (isFunc) return await expression(data, bindings)
            // const helperAliases = (this.env.options['application/x-jsonata']?.helpers ?? {})
            // for (const a in helperAliases) if (this.app.helpers[helperAlias = helperAliases[a]] && transform.includes(`$${a}(`)) await this.loadHelper(helperAlias)
            return await expression.evaluate(data, bindings)
        }
    },
    serialize: {
        enumerable: true, value: async function (input, contentType = 'application/json') {
            contentType ||= 'application/json'
            if (typeof input === 'string') return input
            if (contentType && !contentType.includes('/')) contentType = `application/${contentType}`
            if (contentType === 'application/json') return JSON.stringify(input)
            if ((input instanceof HTMLElement) && (contentType === 'text/html' || contentType === 'text/markdown')) input = input.outerHTML
            if (contentType && contentType.includes('form')) return (new URLSearchParams(input)).toString()
            if (contentType === 'text/css') {
                if (input instanceof HTMLElement) return (await (new CSSStyleSheet()).replace(input.textContent)).cssRules.map(rule => rule.cssText).join('\n')
                if (input instanceof CSSStyleSheet) return input.cssRules.map(rule => rule.cssText).join('\n')
            }
            await this.loadHelper(contentType)
            return this.useHelper(contentType, input, true) ?? `${input}`
        }
    },
    useHelper: {
        enumerable: true, value: function (name, ...args) {
            if (typeof this.app.helpers[name] === 'function') return this.app.helpers[name](...args)
        }
    },

    app: {
        value: Object.defineProperties({
            compile: undefined, components: { classes: {}, natives: new WeakMap(), bindings: new WeakMap(), virtuals: new WeakMap() }, dev: undefined,
            expose: undefined, facets: { classes: {}, instances: new WeakMap() }, gateways: {}, helpers: {},
            interpreters: { matchers: new Map(), parsers: {}, binders: {}, handlers: {} }, namespaces: {},
            options: {}, patterns: {}, resolvers: {}, snippets: {}, transforms: {}, types: {}
        }, {
            cells: { value: {} },
            eventTarget: { value: new EventTarget() },
            libraries: { value: {} },
            observers: { value: new WeakMap() }
        })
    },
    modules: { enumerable: true, value: {} },
    sys: {
        value: Object.freeze({

            color: {
                calculateLuminance: function (color) {
                    const [r, g, b] = this.sys.color.toArray(color)
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b
                },
                canonicalize: function (color, includeAlpha) {
                    if ((includeAlpha && color.startsWith('rgba(')) || (!includeAlpha && color.startsWith('rgb('))) return color
                    const oldHeadColor = document.head.style.getPropertyValue('color')
                    document.head.style.setProperty('color', color)
                    let computedColor = window.getComputedStyle(document.head).getPropertyValue('color')
                    document.head.style.setProperty('color', oldHeadColor)
                    const colorArray = this.sys.color.toArray(computedColor, includeAlpha)
                    return includeAlpha ? `rgba(${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]}, ${colorArray[4]})` : `rgb(${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]})`
                },
                rgbToHsl: function (r, g, b) {
                    r /= 255, g /= 255, b /= 255;
                    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
                    let h, s, l = (max + min) / 2
                    if (max === min) return [0, 0, l * 100]
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break
                        case g: h = (b - r) / d + 2; break
                        case b: h = (r - g) / d + 4; break
                    }
                    h /= 6
                    return [h * 360, s * 100, l * 100]
                },
                toArray: function (color, includeAlpha) {
                    if (Array.isArray(color)) return color
                    if (!color.startsWith('rgb')) color = this.sys.color.canonicalize(color)
                    const useRx = color.startsWith('rgba') ? this.sys.regexp.isRgba : this.sys.regexp.isRbg,
                        [, r, g, b, a = 1] = color.match(useRx) ?? [, 0, 0, 0, (includeAlpha ? 0 : 1)]
                    return includeAlpha ? [r, g, b, a] : [r, g, b]
                }
            },

            selector: Object.freeze({
                clauseOpeners: {
                    '[': true,
                    '#': true,
                    '.': true,
                    '@': function (n, c) { return n.getAttribute('name') === c },
                    '^': function (n, c) { return n.getAttribute('itemprop') === c },
                    '$': function (n, c) { return n.value === c }
                },
                combinators: {
                    '>': function (sc) { return Array.from(sc.chilren()) },
                    '+': function (sc) { return sc.nextElementSibling() ?? [] },
                    '~': function (sc) {
                        const siblings = []
                        let sibling = sc.nextElementSibling
                        while (sibling) {
                            siblings.push(sibling)
                            sibling = sibling.nextElementSibling
                        }
                        return siblings
                    },
                    '||': function (sc) {
                        const colgroup = sc.closest('colgroup'), colElements = Array.from(colgroup.children), table = sc.closest('table'), matchedCells = []
                        let totalColumns = 0, colStart = 0, colEnd = 0;
                        for (const col of colElements) {
                            const span = parseInt(col.getAttribute('span') || '1', 10), colIsSc = col === sc
                            if (colIsSc) colStart = totalColumns
                            totalColumns += span
                            if (colIsSc) colEnd = totalColumns - 1
                        }
                        for (const row of table.querySelectorAll('tr')) {
                            let currentColumn = 0
                            for (const cell of row.children) {
                                const colspan = parseInt(cell.getAttribute('colspan') || '1', 10), cellStart = currentColumn, cellEnd = currentColumn + colspan - 1
                                if ((cellStart >= colStart && cellStart <= colEnd) || (cellEnd >= colStart && cellEnd <= colEnd)) matchedCells.push(cell);
                                currentColumn += colspan
                            }
                        }
                        return matchedCells
                    },
                    '': function (sc) { return Array.from(sc.querySelectorAll('*')) }
                },
                comparators: {
                    '~=': function (iv, rv, f, p) { return iv === rv || iv.split(this.sys.regexp.spaceSplitter).includes(rv) },
                    '|=': function (iv, rv, f, p) { return iv === rv || iv.startsWith(`${rv}-`) },
                    '^=': function (iv, rv, f, p) { return iv.startsWith(rv) },
                    '$=': function (iv, rv, f, p) { return iv.endsWith(rv) },
                    '*=': function (iv, rv, f, p) { return iv.includes(rv) },
                    '/=': function (iv, rv, f, p) { return (new RegExp(rv)).test(iv) },
                    '==': function (iv, rv, f, p) { return ((f === '&') && (p?.endsWith('olor'))) ? (this.sys.color.canonicalize(iv, true) === this.sys.color.canonicalize(rv, true)) : (iv == rv) },
                    '<=': function (iv, rv, f, p) { return (((f === '&') && (p?.endsWith('olor')))) ? this.sys.color.rgbToHsl(...this.sys.color.toArray(iv))[0] <= this.sys.color.rgbToHsl(...this.sys.color.toArray(rv))[0] : parseFloat(iv) <= parseFloat(rv) },
                    '>=': function (iv, rv, f, p) { return (((f === '&') && (p?.endsWith('olor')))) ? this.sys.color.rgbToHsl(...this.sys.color.toArray(iv))[0] >= this.sys.color.rgbToHsl(...this.sys.color.toArray(rv))[0] : parseFloat(iv) >= parseFloat(rv) },
                    '=': function (iv, rv, f, p) { return ((f === '&') && (p?.endsWith('olor'))) ? (this.sys.color.canonicalize(iv) === this.sys.color.canonicalize(rv)) : (iv == rv) },
                    '<': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? this.sys.color.calculateLuminance(iv) < this.sys.color.calculateLuminance(rv) : parseFloat(iv) < parseFloat(rv) },
                    '>': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? this.sys.color.calculateLuminance(iv) > this.sys.color.calculateLuminance(rv) : parseFloat(iv) > parseFloat(rv) },
                    '': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? (this.sys.color.toArray(iv, true)[3] > 0) : !!iv }
                },
                flags: {
                    '%': function (n, cp) { return `${n.style.getPropertyValue(cp)}` },
                    '&': function (n, cp) { return `${window.getComputedStyle(n)[cp]}` },
                    '?': function (n, cp) { return n.dataset[cp] },
                    '$': function (n, cp) { return `${n[cp]}` },
                    '@': function (n, cp) { return n.getAttribute(cp) },
                    '': function (n, cp) { return n.getAttribute(cp) },
                }
            }),

            defaultEventTypes: Object.freeze({
                audio: 'loadeddata', body: 'load', details: 'toggle', dialog: 'close', embed: 'load', form: 'submit', iframe: 'load', img: 'load', input: 'change', link: 'load',
                meta: 'change', object: 'load', script: 'load', search: 'change', select: 'change', slot: 'slotchange', style: 'load', textarea: 'change', track: 'load', video: 'loadeddata'
            }),
            regexp: Object.freeze({
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g, classMatch: /(\.[a-zA-Z0-9\-]+)+/g, commaSplitter: /\s*,\s*/,
                constructorFunction: /constructor\s*\(.*?\)\s*{[^}]*}/s, gatewayUrlTemplateMergeField: /{([^}]+)}/g,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isHTML: /<[^>]+>|&[a-zA-Z0-9]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/,
                isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi, jsonataHelpers: /\$([a-zA-Z0-9_]+)\(/g, leadingSlash: /^\/+/,
                pipeSplitter: /(?<!\|)\|(?!\|)(?![^\[]*\])/, pipeSplitterAndTrim: /\s*\|\s*/, protocolSplitter: /\:\/\/(.+)/, dash: /-/g, xy: /[xy]/g,
                isRgb: /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/, isRgba: /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
                selectorBranchSplitter: /\s*,\s*(?![^"']*["'][^"']*$)/, selectorSegmentSplitter: /(?<=[^\s>+~|\[])\s+(?![^"']*["'][^"']*$)|\s*(?=\|\||[>+~](?![^\[]*\]))\s*/,
                spaceSplitter: /\s+/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g, tagMatch: /^[a-z0-9\-]+/g, isLocalUrl: /^(\.\.\/|\.\/|\/)/
            }),
            voidElementTags: Object.freeze(new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])),
            insertPositions: Object.freeze({ after: true, append: false, before: true, prepend: false, replaceChildren: false, replaceWith: true }),
            impliedScopes: Object.freeze({ ':': '*', '#': 'html' }),
            autoScopes: Object.freeze(new Set(['head', 'body', '^', '~', 'root', 'host', '*', 'html', 'document', 'documentElement', 'window'])),
            valueAliases: Object.freeze({ 'null': null, 'undefined': undefined, 'false': false, 'true': true, '-': null, '?': undefined, '!': false, '.': true }),
            autoResolverSuffixes: Object.freeze({
                component: ['html'], gateway: ['js', 'wasm'], helper: ['js', 'wasm'], snippet: ['html'], syntax: ['js', 'wasm'],
                transform: ['js', 'wasm', 'jsonata'], type: ['js', 'x', 'schema.json', 'json']
            }),
            unitTypeCollectionChecks: Object.freeze({
                mustBeClass: Object.freeze({ components: 'Component', facets: 'Facet' }),
                mustBeWrapped: Object.freeze(new Set(['components', 'facets'])),
                mayBeWrapped: Object.freeze(new Set(['gateways', 'interpreters'])),
                mustBeFunction: Object.freeze(new Set(['hooks', 'resolvers', 'transforms']))
            }),
            locationKeyMap: { '#': 'hash', '/': 'pathname', '?': 'search' }
        })
    },

    activateTag: {
        value: async function (tag) {
            if (!tag || globalThis.customElements.get(tag) || !this.getCustomTag(tag)) return
            const [namespace, ...name] = tag.split('-'), namespaceBase = this.resolveUrl(this.app.namespaces[namespace] ?? this.env.namespaces[namespace]
                ?? (namespace === 'component' ? './components' : `./components/${namespace}`)), id = `${namespaceBase}/${name.join('/')}.html`
            this.app.components.classes[id] = this.env.components[id] ?? (await this.modules.compile?.component(id))
            for (const subspaceName of (this.app.components.classes[id].subspaces)) {
                let virtualSubspaceName = `${subspaceName}x${crypto.randomUUID().split('-').join('')}`
                this.app.namespaces[virtualSubspaceName] = this.app.components.classes[id][subspaceName]
                this.app.components.classes[id].template.innerHTML = this.app.components.classes[id].template.innerHTML
                    .replace(new RegExp(`<${subspaceName}-`, 'g'), `<${virtualSubspaceName}-`).replace(new RegExp(`</${subspaceName}-`, 'g'), `</${virtualSubspaceName}-`)
                    .replace(new RegExp(` is='${subspaceName}-`, 'g'), ` is='${virtualSubspaceName}-`).replace(new RegExp(` is="${subspaceName}-`, 'g'), ` is="${virtualSubspaceName}-`)
                    .replace(new RegExp(` is=${subspaceName}-`, 'g'), ` is=${virtualSubspaceName}-`)
                this.app.components.classes[id].style.textContext = this.app.components.classes[id].style.textContext
                    .replace(new RegExp(`${subspaceName}-`, 'g'), `${virtualSubspaceName}-`)
            }
            globalThis.customElements.define(tag, this.app.components.classes[id], undefined)
        }
    },
    buildCatchallSelector: {
        value: function (selector) {
            const selectorMain = selector.slice(1)
            if (!selectorMain) return selector
            return `${selectorMain},[is="${selectorMain}"],e-${selectorMain},[is="e-${selectorMain}"]`
        }
    },
    deepFreeze: { //optimal
        value: function (obj, copy) {
            if (!Array.isArray(obj) && !this.isPlainObject(obj)) return obj
            if (copy) obj = JSON.parse(JSON.stringify(obj))
            const isArray = Array.isArray(obj), keys = isArray ? obj : Object.keys(obj)
            for (const item of keys) this.deepFreeze(isArray ? item : obj[item])
            return Object.freeze(obj)
        }
    },
    getCustomTag: {
        value: function (element) {
            let tag = (element instanceof HTMLElement) ? (element.getAttribute('is') || element.tagName).toLowerCase() : `${element}`.toLowerCase()
            if (!tag) return
            return ((tag[0] !== '-') && !tag.endsWith('-') && tag.includes('-')) ? tag : undefined
        }
    },
    installModule: { // optimal
        value: async function (moduleName) {
            const { module } = (await import((new URL(`modules/${moduleName}.js`, import.meta.url)).href))
            for (const p in module) if (typeof module[p].value === 'function') (module[p].value = module[p].value.bind(this))
            Object.defineProperty(this.modules, moduleName, { enumerable: true, value: Object.freeze(Object.defineProperties({}, module)) })
        }
    },

    installGateway: { // optimal
        value: async function (protocol) {
            if (!protocol) return
            if (!protocol.endsWith(':')) protocol = `${protocol}:`
            if (this.app.gateways[protocol]) return this.app.gateways[protocol]
            const gatewayManifests = this.env.gateways[protocol]
            if (!(Array.isArray(gatewayManifests) && gatewayManifests.length)) return
            for (let manifest of gatewayManifests) {
                const { gateway, head = gateway, auto, ...ctx } = manifest
                let connection
                switch (typeof head) {
                    case 'string':
                        const connectionResponse = await fetch(`${window.location.protocol}//${head}`, { method: 'HEAD' })
                        if (connectionResponse.ok) connection = await this.parse(connectionResponse)
                        break
                    case 'function':
                        connection = await head.bind(this, { as: 'head', ctx, protocol })()
                        break
                }
                if (!connection) continue
                this.app.gateways[protocol] = typeof gateway === 'function' ? gateway.bind(this, { as: 'gateway', connection, ctx, protocol }) : gateway
                if (auto) {
                    const urlAttributes = ['href', 'src']
                    this.app.observers.set(this.app.gateways[protocol], new MutationObserver(records => {
                        for (const { type, target, attributeName, addedNodes } of records) {
                            if (type !== 'attributes' && type !== 'childList') continue
                            const [targets, processAttributes] = type === 'attributes' ? [[target], [attributeName]] : [addedNodes, urlAttributes]
                            for (const target of targets) {
                                if (!(target instanceof HTMLElement)) continue
                                for (const attributeName of processAttributes) {
                                    const attributeValue = target.getAttribute(attributeName)
                                    if (!attributeValue) continue
                                    let valueUrl
                                    try { valueUrl = new URL(attributeValue, document.baseURI) } catch (e) { continue }
                                    if (valueUrl.protocol === protocol) {
                                        const resolvedUrl = this.resolveUrl(attributeValue)
                                        let resolveUrlObj
                                        try { resolveUrlObj = new URL(resolvedUrl) } catch (e) { continue }
                                        if (resolveUrlObj.protocol !== protocol) target.setAttribute(attributeName, resolvedUrl)
                                    }
                                }
                            }
                        }
                    }))
                    this.app.observers.get(this.app.gateways[protocol]).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: urlAttributes })
                }
                return this.app.gateways[protocol]
            }
        }
    },
    mergeArgs: {
        value: function (args, value, envelope = {}) {
            const newArgs = []
            for (let a of (args ?? [])) {
                const aSpread = a.startsWith('...')
                if (aSpread) a = a.slice(3)
                if (aSpread && !Array.isArray(a)) a = [a]
                if (value !== undefined) {
                    const { cells, context, fields, labels } = envelope
                    if (aSpread) {
                        const newA = []
                        for (const aa of a) newA.push(this.resolveVariable(aa, { wrapped: false }, { cells, context, fields, labels, value }))
                        a = newA
                    } else {
                        a = this.resolveVariable(a, { wrapped: false }, { cells, context, fields, labels, value })
                    }
                }
                aSpread ? newArgs.push(...a) : newArgs.push(a)
            }
            return newArgs
        }
    },
    mountFacet: {
        value: async function (facetContainer) {
            let { type, textContent } = facetContainer, src = facetContainer.getAttribute('src'), facetInstance, FacetClass, facetCid
            if (type === 'facet/element') type = src ? 'application/element' : 'directives/element'
            switch (type) {
                case 'directives/element':
                    if (!this.modules.compile) return
                    const directives = await this.modules.compile?.canonicalizeDirectives(src ? await fetch(this.resolveUrl(src)).then(r => r.text()) : textContent)
                    if (!directives) break
                    facetCid = await this.modules.compile.cid(directives)
                    this.app.facets.classes[facetCid] ??= await this.modules.compile?.facet(directives, facetCid)
                    break
                case 'application/element':
                    if (!src || this.app.facets.classes[src]) break
                    FacetClass = (this.env.facets[src]?.prototype instanceof this.Facet) ? this.env.facets[src] : (await import(this.resolveUrl(src)))
                    FacetClass.E ??= this
                    FacetClass.prototype.E ??= E
                    facetCid = FacetClass.cid
                    this.app.facets.classes[facetCid] = FacetClass
                    this.app.facets.classes[src] = FacetClass
                    break
            }
            FacetClass = this.app.facets.classes[facetCid]
            if (this.modules.dev && !this.app.facets.exports.has(FacetClass)) this.app.facets.exports.set(FacetClass, { statements: JSON.parse(JSON.stringify(FacetClass.statements)) })
            if (!FacetClass || !(FacetClass.prototype instanceof this.Facet)) return
            if (this.modules.dev) facetContainer.dataset.facetCid = facetCid
            facetInstance = new FacetClass()
            this.app.facets.instances.set(facetContainer, facetInstance)
            const rootNode = facetContainer.getRootNode(), fields = {}, cells = {},
                context = Object.freeze(rootNode instanceof ShadowRoot ? { ...this.env.context, ...Object.fromEntries(Object.entries(rootNode.host.dataset)) } : this.env.context)
            for (const fieldName of FacetClass.fieldNames) fields[fieldName] = (new this.Field(facetInstance, fieldName))
            for (const cellName of FacetClass.cellNames) cells[cellName] = new this.Cell(cellName)
            Object.freeze(fields)
            Object.freeze(cells)
            facetInstance.observer = new MutationObserver(records => facetInstance.disabled = facetContainer.hasAttribute('disabled'))
            facetInstance.observer.observe(facetContainer, { attributes: true, attributeFilter: ['disabled'] })
            facetInstance.disabled = facetContainer.hasAttribute('disabled')
            await facetInstance.run(facetContainer, Object.freeze({ fields, cells, context }))
        }
    },
    processQueue: {
        value: async function () {
            const firstKey = this.queue.keys().next().value
            if (firstKey !== undefined) {
                const job = this.queue.get(firstKey)
                this.queue.delete(firstKey)
                if (typeof job === 'function') await job()
            }
            await new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100))
            this.processQueue()
        }
    },
    renderWithSnippet: {
        value: function (element, data, tag, insertPosition, insertSelector, id, classList, attributeMap) {
            if (insertSelector) element = element.querySelector(insertSelector)
            if (!element) return
            const sort = Array.prototype.toSorted ? 'toSorted' : 'sort'
            classList = (classList && Array.isArray(classList)) ? classList.map(s => s.trim()).filter(s => !!s)[sort]() : []
            const attrEntries = (attributeMap && (attributeMap instanceof Object)) ? Object.entries(attributeMap) : []
            if (this.sys.voidElementTags.has(element.tagName.toLowerCase()) && !this.sys.insertPositions[insertPosition]) insertPosition = insertPosition === 'prepend' ? 'before' : 'after'
            let useNode
            if (tag instanceof HTMLTemplateElement) {
                useNode = tag.content.cloneNode(true)
            } else if (tag instanceof HTMLElement) {
                useNode = tag.cloneNode(true)
            } else if (typeof tag === 'string') {
                useNode = document.createElement(tag)
            } else { return }
            if (id && (typeof id === 'string') && !(Array.isArray(data))) useNode.setAttribute('id', id)
            const buildNode = node => {
                for (let className of classList) node.classList[(className[0] === '!') ? 'remove' : 'add']((className[0] === '!') ? className.slice(1) : className)
                for (const [n, v] of attrEntries) node[`${((typeof v !== 'string') && (typeof v !== 'number')) ? 'toggle' : 'set'}Attribute`](n, v)
                return node
            }
            let nodesToApply = []
            if (Array.isArray(data)) {
                for (const vv of data) if (vv) nodesToApply.push([buildNode(useNode.cloneNode(true)), vv])
            } else if (data) { nodesToApply.push([buildNode(useNode), data]) }
            if (!nodesToApply.length) return
            for (const n of nodesToApply) if (n[1] && (n[1] !== true)) this.render(...n)
            element[insertPosition](...nodesToApply.map(n => n[0] instanceof DocumentFragment ? Array.from(n[0].cloneNode(true).children) : n[0]).flat())
        }
    },
    resolveImport: { //optimal
        enumerable: true, value: async function (importHref, returnWholeModule, isWasm) {
            const { hash = '#default', origin, pathname } = this.resolveUrl(importHref, undefined, true), url = `${origin}${pathname}`
            isWasm ??= pathname.endsWith('.wasm')
            const module = isWasm ? (await WebAssembly.instantiateStreaming(fetch(url))).instance.exports : await import(url)
            return returnWholeModule ? module : module[hash.slice(1)]
        }
    },
    resolvePackageItem: {
        value: async function (item, scope) {
            switch (scope) {
                case 'components': case 'facets': return await item(this)
                default: return typeof item === 'function' ? (await item(this)) : item
            }
        }
    },
    resolveSnippetKey: {
        value: function (snippetKey) {
            if (snippetKey[0] === '`' && snippetKey.endsWith('`')) {
                snippetKey = snippetKey.slice(1, -1)
                switch (snippetKey[0]) {
                    case '.': case '/': break
                    case '~':
                        if (snippetKey[1] === '/') snippetKey = `snippets${snippetKey.slice(1)}`
                        break
                    default:
                        if (!snippetKey.startsWith('snippets/')) snippetKey = `snippets/${snippetKey}`
                }
                if (snippetKey.endsWith('.')) snippetKey = `${snippetKey}html`
                if (!snippetKey.includes('.')) snippetKey = `${snippetKey}.html`
            }
            return snippetKey
        }
    },

    resolveUnit: {
        value: async function (unitExpression, unitType) {
            unitExpression = unitExpression.trim()
            if (!unitExpression) return
            if (this.app[unitType][unitExpression]) return this.app[unitType][unitExpression]
            if (this.env[unitType][unitExpression]) return this.app[unitType][unitExpression] = this.env[unitType][unitExpression]
            let unitUrl
            switch (unitExpression[0]) {
                case '.': case '/':
                    unitUrl = this.resolveUrl(unitExpression, undefined, true)
                    break
                default:
                    if (unitUrl.includes('://')) try { unitUrl = this.resolveUrl(new URL(unitExpression).href, undefined, true) } catch (e) { }
            }
            let unit
            if (!unitUrl) {
                if (typeof this.app.resolver[unitType] === 'function') return await this.app.resolver[unitType](unitExpression)
                for (const s of this.sys.autoResolverSuffixes[unitType]) if (unitExpression.endsWith(`.${s}`) && (unitUrl = this.resolveUrl(`${unitType}/${unitExpression}`, undefined, true))) break
            }
            if (!unitUrl) {
                for (const s of this.sys.autoResolverSuffixes[unitType]) {
                    const testUrl = `${unitType}/${unitExpression}.${s}`
                    if ((await fetch(testUrl, { method: 'HEAD' })).ok) {
                        unitUrl = this.resolveUrl(testUrl, undefined, true)
                        break
                    }
                }
            }
            if (unitUrl) {
                const { hash, pathname } = unitUrl
                let unitContainer
                if (pathname.endsWith('.js') || pathname.endsWith('.wasm')) {
                    const unitModule = await import(unitUrl.href)
                    unit = hash ? unitModule[hash] : unitModule.default
                } else if (pathname.endsWith('.json')) {
                    const unitModule = await (await fetch(unitUrl.href)).json()
                    unit = hash ? unitModule[hash] : unitModule
                } else {
                    const unitModule = await fetch(unitUrl.href)
                    unit = await this.parse(unitModule) ?? (await unitModule.text())
                }
                return this.app[unitType][unitExpression] = unit
            }
        }
    },

    runElementMethod: {
        value: function (statement, arg, element) {
            let [funcName, ...argsRest] = statement.split('(')
            if (typeof element[funcName] === 'function') {
                const cells = {}
                for (const c in this.app.cells) cells[c] = this.app.cells[c].value
                argsRest = argsRest.join('(').slice(0, -1)
                argsRest = argsRest ? argsRest.split(',').map(a => this.resolveVariable(a.trim(), { wrapped: false }, { cells, context: this.env.context, value: a.trim() })) : []
                return element[funcName](...argsRest, ...([arg]))
            }
        }
    },
    runFragmentAsMethod: {
        value: function (fragment, value) {
            const [methodName, argsList] = fragment.slice(0, -1).split('(').map((s, i) => i ? s.split(',').map(ss => ss.trim()) : s.trim()),
                valuePrototype = value?.constructor?.prototype
            if (valuePrototype && (typeof value[methodName] === 'function')) return value[methodName](...this.mergeArgs(argsList, value))
            return
        }
    },
    setGlobalNamespace: {
        enumerable: true, value: function () {
            if (!this.app._globalNamespace) {
                Object.defineProperty(this.app, '_globalNamespace', { value: crypto.randomUUID() })
                Object.defineProperty(globalThis, this.app._globalNamespace, { value: this })
                Object.freeze(this.app)
            }
        }
    },
    sliceAndStep: {
        value: function (sig, list) {
            if (!sig.includes(':')) return [list[parseInt(sig) || 0]]
            let [start = 0, end = list.length, step = 0] = sig.split(':').map(s => (parseInt(s) || 0))
            if (end === 0) end = list.length
            list = list.slice(start, end)
            if (!step) return list
            return (step === 1) ? list.filter((v, i) => (i + 1) % 2) : list.filter((v, i) => (i + 1) % step === 0)
        }
    },
    unmountFacet: {
        value: function (facetContainer) {
            const facetInstance = this.app.facets.instances.get(facetContainer)
            for (const [k, v] of Object.entries((facetInstance.controllers))) v.abort()
            facetInstance.controller.abort()
            facetInstance.observer.disconnect()
        }
    },
    isValidTag: {
        value: function (tag) {
            return !(document.createElement(tag) instanceof HTMLUnknownElement)
        }
    },

    Component: {
        enumerable: true, value: class extends globalThis.HTMLElement {
            static attributes = { observed: [] }
            static shadow = { mode: 'open' }
            static events = { default: undefined }
            static extends
            static native
            static id
            static properties = { flattenable: this.observedAttributes ?? [], value: undefined }
            static style
            static subspaces = []
            static template
            static get observedAttributes() { return (super.observedAttributes || []).concat(...(this.attributes.observed ?? [])) }
            constructor() {
                super()
                try {
                    if (this.constructor.style || this.constructor.template) {
                        const shadowRoot = this.attachShadow(this.constructor.shadow)
                        if (this.constructor.style) shadowRoot.append(this.constructor.style.cloneNode(true))
                        if (this.constructor.template) shadowRoot.append(...this.constructor.template.content.cloneNode(true).children)
                    }
                } catch (e) { }
            }
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            valueOf() { return this.E.flatten(this) }
            toJSON() { return this.valueOf() }
            dispatchEvent(event) {
                let virtualElement = this.constructor.E.app.components.virtuals.get(this), nativeElement = this.constructor.E.app.components.natives.get(this)
                let eventName = event.type === 'default' ? undefined : event.type
                const isPair = (virtualElement || nativeElement), { detail, bubbles, cancelable, composed } = event
                if (isPair) {
                    virtualElement ??= this
                    nativeElement ??= this
                    eventName ??= virtualElement.constructor.events?.default ?? this.constructor.E.sys.defaultEventTypes[nativeElement.tagName.toLowerCase()] ?? 'click'
                    return virtualElement.dispatchEvent(new CustomEvent(eventName, { detail, bubbles, cancelable, composed }))
                        && nativeElement.dispatchEvent(new CustomEvent(eventName, { detail, bubbles, cancelable, composed }))
                }
                eventName ??= instance instanceof this.constructor.E.Component ? (instance.constructor.events?.default) : this.constructor.E.sys.defaultEventTypes[instance.tagName.toLowerCase()]
                return super.dispatchEvent(new CustomEvent(eventName ?? 'click', { detail, bubbles, cancelable, composed }))
            }
        }
    },
    Facet: {
        enumerable: true, value: class {
            static E
            controller
            controllers = {}
            fields = {}
            observer
            descriptors = {}
            labels = []
            disabled
            constructor() {
                this.controller = new AbortController()
                for (const fieldName of this.constructor.fieldNames) this.fields[fieldName] = new this.constructor.E.Field(this, fieldName)
                Object.freeze(this.fields)
            }
            async run(container, { fields, cells, context }) {
                for (const [statementIndex, statement] of this.constructor.statements.entries()) {
                    this.labels[statementIndex] = {}
                    const { steps = [] } = statement, labels = this.labels[statementIndex], saveToLabel = (stepIndex, label, value, labelMode) => {
                        labels[`${stepIndex}`] = value
                        if (label && (label != stepIndex)) {
                            switch (label[0]) {
                                case '@':
                                    fields[label.slice(1)].set(value, labelMode)
                                    break
                                case '#':
                                    cells[label.slice(1)].set(value, labelMode)
                                    break
                                default:
                                    labels[label] = value
                            }
                        }
                    }
                    for (const label of statement.labels) labels[label] = undefined
                    for (const [stepIndex, step] of steps.entries()) {
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, defaultExpression, signature } = step,
                            { interpreter: interpreterKey, descriptor = {} } = signature, { signal } = descriptor,
                            envelope = { descriptor, labels, fields, cells, context }
                        let interpreter, matcher
                        for (matcher of this.constructor.E.env.interpreters.keys()) if (matcher.toString() === interpreterKey) break
                        if (matcher) interpreter = this.constructor.E.env.interpreters.get(matcher)
                        if (!interpreter) continue
                        const { binder, handler, name } = interpreter, execStep = async previousStepIndex => {
                            if (this.disabled) return
                            const E = this.constructor.E, handlerEnvelope = { ...envelope, fields: Object.freeze(E.flatten(fields)), cells: Object.freeze(E.flatten(cells)), labels: Object.freeze({ ...labels }) }
                            const value = previousStepIndex !== undefined ? labels[`${previousStepIndex}`] : undefined, detail = await handler(container, position, handlerEnvelope, value)
                                ?? (defaultExpression ? this.constructor.E.resolveVariable(defaultExpression, { wrapped: false }, { ...handlerEnvelope, value }) : undefined)
                            if (detail !== undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                        }
                        if (signal) descriptor.signal = (this.controllers[position] = new AbortController()).signal
                        if (binder) Object.assign(descriptor, (await binder(container, position, envelope) ?? {}))
                        this.descriptors[position] = Object.freeze(descriptor)
                        container.addEventListener(`done-${position}`, async event => {
                            saveToLabel(stepIndex, label, event.detail, labelMode)
                        }, { signal: this.controller.signal })
                        const previousStepIndex = stepIndex ? stepIndex - 1 : undefined
                        container.addEventListener(stepIndex ? `done-${statementIndex}-${previousStepIndex}` : 'run', async event => execStep(previousStepIndex), { signal: this.controller.signal })
                    }
                }
                container.dispatchEvent(new CustomEvent('run'))
            }
            valueOf() {
                const fields = {}
                for (const f in this.fields) fields[f] = this.fields[f].value
                return fields
            }
            toJSON() { return this.valueOf() }
        }
    },
    State: {
        value: class {
            name
            type
            value
            eventTarget = new EventTarget()
            get() { return this.value }
            set(value, labelMode) {
                let isSame = this.value === value
                if (!isSame) try { isSame = JSON.stringify(this.value) === JSON.stringify(value) } catch (e) { }
                if (isSame) {
                    if (labelMode === 'force') this.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                    return this
                }
                this.value = value
                if (labelMode !== 'silent') this.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                return this
            }
            constructor(name, initialValue) {
                this.name = name
                this.value = initialValue
            }
            valueOf() { return this.value }
            toJSON() { return this.valueOf() }
        }
    },
    Validator: {
        enumerable: true, value: class {

            constructor(obj) {
                if (!obj || (typeof obj !== 'object')) return
                for (const p in obj) if (typeof this[p] === 'function') Object.defineProperty(this, p, { enumerable: true, writable: false, value: this[p](obj[p]) })
            }

            valueOf() { return Object.values(this).every(v => v === true) }
        }
    },
    Job: {
        enumerable: true, value: class {

            id
            jobFunction
            runner
            running = false

            static cancelJob(id) { return this.E.queue.delete(id) }
            static isRunning(id) { return this.E.queue.get(id)?.running }
            static getJobFunction(id) { return this.E.queue.get(id)?.jobFunction }
            static getJobRunner(id) { return this.E.queue.get(id)?.runner }

            constructor(id, jobFunction) {
                this.id = id ?? this.constructor.E.generateUuid()
                if (this.constructor.E.queue.get(id)) return
                this.jobFunction = jobFunction
                this.runner = async () => {
                    this.running = true
                    try { await this.jobFunction.call(this.constructor.E) } finally { this.cancel() }
                }
                this.constructor.E.queue.set(this.id, this)
            }

            cancel() { this.constructor.E.queue.delete(this.id) }

        }
    },
    queue: { value: new Map() }
})
ElementHTML.Component.E = ElementHTML
ElementHTML.Facet.E = ElementHTML
ElementHTML.Validator.E = ElementHTML
ElementHTML.Job.E = ElementHTML
Object.defineProperties(ElementHTML, {
    Cell: {
        value: class extends ElementHTML.State {
            constructor(name, initialValue) {
                if (name && ElementHTML.app.cells[name]) return ElementHTML.app.cells[name]
                super(name, initialValue)
                if (this.name) ElementHTML.app.cells[this.name] ??= this
            }
        }
    },
    Field: {
        value: class extends ElementHTML.State {
            constructor(facetInstanceOrContainer, name, initialValue) {
                let fields = (facetInstanceOrContainer instanceof ElementHTML.Facet) ? facetInstanceOrContainer.fields : ((facetInstanceOrContainer instanceof HTMLElement) ? ElementHTML.app.facets.instances.get(facetInstanceOrContainer).fields : undefined)
                if (name && fields[name]) return fields[name]
                super(name, initialValue)
                if (name && fields) fields[name] ??= this
            }
        }
    }
})

// optimal
const metaUrl = new URL(import.meta.url), initializationParameters = metaUrl.searchParams, promises = [], functionMap = { compile: 'Compile', dev: 'Dev', expose: 'Expose' }
for (const f in functionMap) if (initializationParameters.has(f)) promises.push(ElementHTML[functionMap[f]](initializationParameters.get(f)))
await Promise.all(promises)
if (initializationParameters.has('packages')) {
    let imports = {}
    const importmapElement = document.head.querySelector('script[type="importmap"]'), importmap = { imports }, importPromises = new Map(), packageList = []
    for (let s of initializationParameters.get('packages').split(',')) if (s = s.trim()) packageList.push(s)
    if (importmapElement) {
        try { imports = Object.assign(importmap, JSON.parse(importmapElement.textContent.trim())).imports } catch (e) { }
    } else if (initializationParameters.get('packages')) {
        for (const p of packageList) imports[p] = `./packages/${p}.js`
    } else {
        imports.main = './packages/main.js'
        packageList.push('main')
    }
    for (const key of packageList) {
        const { protocol } = new URL(imports[key], document.baseURI)
        if (protocol !== window.location.protocol) await ElementHTML.installGateway(protocol, ElementHTML.env.gateways[protocol] ?? window[protocol])
        const importUrl = ElementHTML.resolveUrl(imports[key])
        if (!importUrl) continue
        importPromises.set(importUrl, { promise: import(importUrl), key })
    }
    await Promise.all(Array.from(importPromises.values()))
    for (const [url, imp] of importPromises) await ElementHTML.ImportPackage(await imp.promise, url, imp.key)
}
if (initializationParameters.has('load')) await ElementHTML.Load()

export { ElementHTML }