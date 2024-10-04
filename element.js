const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '2.0.0' }, // optimal

    env: {
        enumerable: true, value: {
            ais: {}, apis: {}, components: {}, content: {}, context: {}, facets: {}, gateways: {}, hooks: {},
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
                        return this.resolveVariable(descriptor.expression, Object.freeze({ ...envelope, value }))
                    }
                }],
                [/^[{](.*?)[}]$|^[\[](.*?)[\]]$|^\?[^ ]+$/, {
                    name: 'shape',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope
                        return this.resolveVariable(descriptor.shape, Object.freeze({ ...envelope, value }))
                    }
                }],
                [/^#\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'content',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, variables } = envelope, { collection: a, article: articleSignature, lang: langSignature } = descriptor, wrapped = variables ? true : undefined,
                            valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined,
                            collection = await this.resolveUnit(variables?.collection ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'collection')
                        if (!collection) return
                        const article = variables?.article ? this.resolveVariable(articleSignature, valueEnvelope, { wrapped }) : articleSignature
                        if (variables?.article && !article) return
                        const lang = variables?.lang ? this.resolveVariable(langSignature, valueEnvelope, { wrapped }) : langSignature
                        return collection?.run(article, lang ?? container.lang, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { collection: collectionSignature } = descriptor
                        if (!variables?.collection) new Job(async function () { await this.resolveUnit(collectionSignature, 'collection') }, `collection:${collectionSignature}`)
                    }
                }],
                [/^\(.*\)$/, {
                    name: 'transform',
                    handler: async function (container, position, envelope, value) { // optimal
                        let { descriptor, variables } = envelope, { transform: t } = descriptor, variablesTransform = variables?.transform, wrapped = variablesTransform ? true : undefined,
                            valueEnvelope = variablesTransform ? Object.freeze({ ...envelope, value }) : envelope,
                            transform = await this.resolveUnit(variablesTransform ? this.resolveVariable(t, valueEnvelope, { wrapped }) : t, 'transform')
                        return transform?.run(value, container, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { transform: transformSignature } = descriptor
                        if (!variables?.transform) new Job(async function () { await this.resolveUnit(transformSignature, 'transform') }, `transform:${transformSignature}`)
                    }
                }],
                [/^\/.*\/$/, {
                    name: 'pattern',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, variables } = envelope, { pattern: p } = descriptor, wrapped = variables ? true : undefined,
                            valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined,
                            pattern = await this.resolveUnit(variables.pattern ? this.resolveVariable(p, valueEnvelope, { wrapped }) : p, 'pattern')
                        if (!(pattern instanceof RegExp)) return
                        if (pattern.lastIndex) pattern.lastIndex = 0
                        const match = value.match(pattern)
                        return match?.groups ? Object.fromEntries(Object.entries(match.groups)) : (match ? match[1] : undefined)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { pattern: patternSignature } = descriptor
                        if (!variables?.pattern) new Job(async function () { await this.resolveUnit(patternSignature, 'pattern') }, `pattern:${patternSignature}`)
                    }
                }],
                [/^\|.*\|$/, {
                    name: 'type',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { types, mode } = descriptor, promises = [], wrapped = true, valueEnvelope = { ...envelope, value }
                        for (const t of types) if (this.isWrappedVariable(t.name)) promises.push(this.resolveUnit(this.resolveVariable(t.name, valueEnvelope, { wrapped }), 'type'))
                        await Promise.all(promises)
                        let pass
                        switch (mode) {
                            case 'any':
                                for (const { if: ifMode, name } of types) if (pass = (ifMode === (await this.runUnit(name, 'type', value)))) break
                                break
                            case 'all':
                                for (const { if: ifMode, name } of types) if (!(pass = (ifMode === (await this.runUnit(name, 'type', value))))) break
                                break
                            case 'info':
                                pass = true
                                const validation = {}, promises = []
                                for (const { name } of types) promises.push(this.runUnit(name, 'type', value, true).then(r => validation[name] = r))
                                await Promise.all(promises)
                                return { value, validation }
                        }
                        if (pass) return value
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { types } = descriptor
                        for (t of types) if (!this.isWrappedVariable(t.name)) new Job(async function () { await this.resolveUnit(t.name, 'type') }, `type:${t}`)
                    }
                }],
                [/^\$\(.*\)$/, {
                    name: 'selector',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { scope, selector } = descriptor
                        if (value != undefined) {
                            const target = this.resolveSelector(selector, scope)
                            if (Array.isArray(target)) for (const t of target) this.render(t, value)
                            else if (target) this.render(target, value)
                        }
                        return value
                    },
                    binder: async function (container, position, envelope) { // optimal
                        const { descriptor } = envelope, { signal } = descriptor, { scope: scopeStatement, selector: selectorStatement } = descriptor,
                            scope = this.resolveScope(scopeStatement, container)
                        if (!scope) return {}
                        const lastIndexOfBang = selectorStatement.lastIndexOf('!')
                        let selector = selectorStatement.trim(), eventList
                        if (lastIndexOfBang > selector.lastIndexOf(']') && lastIndexOfBang > selector.lastIndexOf(')') && lastIndexOfBang > selector.lastIndexOf('"') && lastIndexOfBang > selector.lastIndexOf("'"))
                            [selector, eventList] = [selector.slice(0, lastIndexOfBang).trim(), selector.slice(lastIndexOfBang + 1).trim()]
                        if (eventList) eventList = eventList.split(this.sys.regexp.commaSplitter).filter(Boolean)
                        else if (container.dataset.facetCid) {
                            const [statementIndex, stepIndex] = position.split('-')
                            if (!this.app.facets[container.dataset.facetCid]?.statements?.[+statementIndex]?.steps[+stepIndex + 1]) return { selector, scope }
                        }
                        const eventNames = eventList ?? Array.from(new Set(Object.values(this.sys.defaultEventTypes).concat(['click'])))
                        for (let eventName of eventNames) {
                            const eventNameSlice3 = eventName.slice(-3), keepDefault = eventNameSlice3.includes('+'), exactMatch = eventNameSlice3.includes('='), once = eventNameSlice3.includes('-')
                            for (const [v, r] of [[keepDefault, '+'], [exactMatch, '='], [once, '-']]) if (v) eventName = eventName.replace(r, '')
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
                                } else if (selector && exactMatch && !event.target.matches(selector)) return
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
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor } = envelope, { getReturnValue, shape, target } = descriptor
                        if (value == undefined) return getReturnValue()
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
                        return { getReturnValue, target }
                    }
                }],
                [/^!\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'api',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, variables } = envelope, { api: a, action: actionSignature } = descriptor, wrapped = variables ? true : undefined,
                            valueEnvelope = Object.freeze({ ...envelope, value }),
                            api = await this.resolveUnit(variables?.api ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'api')
                        if (!api) return
                        const action = variables?.action ? this.resolveVariable(actionSignature, valueEnvelope, { wrapped }) : actionSignature
                        if (variables?.action && !action) return
                        return api.run(value, action, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { api: apiSignature } = descriptor
                        if (!variables?.api) new Job(async function () { await this.resolveUnit(apiSignature, 'api') }, `api:${apiSignature}`)
                    }
                }],
                [/^@\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'ai',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, variables } = envelope, { ai: m, prompt: p } = descriptor, wrapped = variables ? true : undefined, valueEnvelope = Object.freeze({ ...envelope, value }),
                            ai = await this.resolveUnit(variables?.ai ? this.resolveVariable(m, valueEnvelope, { wrapped }) : a, 'ai')
                        // prompt = this.resolveVariable(p || '$', valueEnvelope, { merge: true })
                        if (!ai) return
                        return ai.run(value, prompt, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { ai: aiSignature, } = descriptor
                        if (!variables?.ai) new Job(async function () { await this.resolveUnit(aiSignature, 'ai') }, `ai:${aiSignature}`)
                    }
                }],
                [/^`[^`]+(\|[^`]+)?`$/, {
                    name: 'request',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, variables } = envelope, wrapped = variables ? true : undefined, valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined
                        let { url, contentType } = descriptor
                        url = this.resolveUrl(variables?.url ? this.resolveVariable(url, valueEnvelope, { wrapped }) : url)
                        if (!url) return
                        contentType = variables?.contentType ? this.resolveVariable(contentType, valueEnvelope, { wrapped }) : contentType
                        if (value === null) value = { method: 'HEAD' }
                        switch (typeof value) {
                            case 'undefined': value = { method: 'GET' }; break
                            case 'boolean': value = { method: value ? 'GET' : 'DELETE' }; break
                            case 'bigint': value = value.toString(); break
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
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { contentType } = descriptor
                        if (!variables?.contentType) new Job(async function () { await this.resolveUnit(contentType, 'transform') }, `transform:${contentType}`)
                    }
                }],
                [/^_.*_$/, {
                    name: 'wait',
                    handler: async function (container, position, envelope, value) { // optimal
                        const { descriptor, labels, fields, cells, context, variables } = envelope, { expression } = descriptor, isPlusExpression = (expression[0] === '+'),
                            wrapped = (variables || isPlusExpression) ? true : undefined, valueEnvelope = (variables || isPlusExpression) ? Object.freeze({ ...envelope, value }) : undefined,
                            done = () => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: value })), now = Date.now()
                        let ms = 0
                        if (expression === 'frame') await new Promise(resolve => globalThis.requestAnimationFrame(resolve))
                        else if (expression.startsWith('idle')) {
                            let timeout = expression.split(':')[0]
                            timeout = timeout ? (parseInt(timeout) || 1) : 1
                            await new Promise(resolve => globalThis.requestIdleCallback ? globalThis.requestIdleCallback(resolve, { timeout }) : setTimeout(resolve, timeout))
                        }
                        else if (isPlusExpression) ms = parseInt(this.resolveVariable(expression.slice(1), valueEnvelope, { wrapped })) || 1
                        else if (this.sys.regexp.isNumeric.test(expression)) ms = (parseInt(expression) || 1) - now
                        else {
                            if (variables?.expression) expression = this.resolveVariable(expression, valueEnvelope, { wrapped })
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
                        if (!this.modules.dev) return value
                        const { descriptor, variables } = envelope, { invocation } = descriptor,
                            wrapped = variables ? true : undefined, valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined
                        $([variables?.invocation ? this.resolveVariable(invocation, valueEnvelope, { wrapped }) : invocation])
                        return value
                    }
                }],
                [/^\$\??$/, {
                    name: 'console',
                    handler: async function (container, position, envelope, value) { // optimal
                        if (!this.modules.dev) return value;
                        (envelope.descriptor.verbose === true) ? (console.log(this.flatten({ container, position, envelope, value }))) : (console.log(value))
                        return value
                    }
                }]
            ]),
            languages: {},
            libraries: {
                jsonata: 'https://cdn.jsdelivr.net/npm/jsonata@2.0.5/+esm', md: 'https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm#Remarkable',
                'schema.json': 'https://cdn.jsdelivr.net/gh/nuxodin/jema.js@1.2.0/schema.min.js#Schema', xdr: 'https://cdn.jsdelivr.net/gh/cloudouble/simple-xdr/xdr.min.js'
            },
            models: {},
            namespaces: { e: new URL(`./components`, import.meta.url) },
            patterns: {}, resolvers: {}, snippets: {},
            transforms: { // TODO: wrap as this.Transform class instances
                'application/json': function (inputValue) { try { return JSON.stringify(inputValue) } catch (e) { } },
                'application/schema+json': 'schema.json', 'application/x-jsonata': 'jsonata', 'form': 'form', 'xdr': 'xdr', 'text/markdown': 'md'
            },
            types: {}
        }
    },

    expose: { enumerable: true, writable: true, value: false }, // optimal

    Compile: { //optimal
        enumerable: true, value: function () {
            return this.installModule('compile').then(() => {
                for (const [, interpreter] of this.env.interpreters) interpreter.parser = this.modules.compile.parsers[interpreter.name].bind(this)
                Object.defineProperty(globalThis, this.modules.compile.globalNamespace, { value: this })
            })
        }
    },
    Dev: { //optimal
        enumerable: true, value: function () {
            return this.installModule('dev').then(() => {
                for (const [p, v = this.modules.dev[p]] of Object.getOwnPropertyNames(this.modules.dev)) if (this.isPlainObject(v)) for (const [pp, vv = v[pp]] in v) if (typeof vv === 'function') v[pp] = vv.bind(this)
            }).then(() => this.modules.dev.console.welcome())
        }
    },
    Expose: { //optimal
        enumerable: true, value: function (name) {
            this.expose = !!(window[name || 'E'] ??= this)
        }
    },
    ImportPackage: { // optimal
        enumerable: true, value: async function (pkg, packageUrl, packageKey) {
            if (!this.isPlainObject(pkg)) return
            if (typeof pkg.hooks?.prePackageInstall === 'function') pkg = (await pkg.hooks.prePackageInstall(this)) ?? pkg
            const promises = [], postPackageInstall = pkg.hooks?.postPackageInstall
            if (postPackageInstall) delete pkg.hooks.postPackageInstall
            for (const unitTypeCollectionName in pkg) if (unitTypeCollectionName in this.env) {
                let unitTypeCollection = (typeof pkg[unitTypeCollectionName] === 'string')
                    ? this.resolveImport(this.resolveUrl(pkg[unitTypeCollectionName], packageUrl), true) : Promise.resolve(pkg[unitTypeCollectionName])
                promises.push(unitTypeCollection.then(unitTypeCollection => this.attachUnitTypeCollection(unitTypeCollection, unitTypeCollectionName, packageUrl, packageKey, pkg)))
            }
            await Promise.all(promises)
            if (typeof postPackageInstall === 'function') await postPackageInstall(this)
        }
    },
    Load: { // optimal
        enumerable: true, value: async function (rootElement = undefined) {
            for (const [, interpreter] of this.env.interpreters) for (const p of ['handler', 'binder']) if (interpreter[p]) interpreter[p] = interpreter[p].bind(this)
            const interpretersProxyError = () => { throw new Error('Interpreters are read-only at runtime.') }
            this.env.interpreters = Object.freeze(new Proxy(this.env.interpreters, {
                set: interpretersProxyError, delete: interpretersProxyError, clear: interpretersProxyError,
                get: (target, prop) => (typeof target[prop] === 'function') ? target[prop].bind(target) : Reflect.get(target, prop)
            }))
            Object.freeze(this.env)
            Object.freeze(this.app)
            for (const eventName of this.sys.windowEvents) window.addEventListener(eventName, event => {
                this.app.eventTarget.dispatchEvent(new CustomEvent(eventName, { detail: this }))
                this.runHook(eventName)
            })
            this.mountElement(document.documentElement).then(async () => {
                this.app.eventTarget.dispatchEvent(new CustomEvent('load', { detail: this }))
                await this.runHook('load')
                new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100)).then(() => this.processQueue())
            })
        }
    },



    flatten: { //optimal
        enumerable: true, value: function (value, event) {
            if (value == undefined) return null
            switch (typeof value) {
                case 'string': case 'number': case 'boolean': return value
                case 'bigint': case 'symbol': return value.toString()
                case 'function': return undefined
            }
            let result
            switch (value?.constructor) {
                case Blob: return { size: value.size, type: value.type }
                case File: return { size: value.size, type: value.type, lastModified: value.lastModified, name: value.name }
                case DataTransferItem: return { kind: value.kind, type: value.type }
                case FileList: case DataTransferItemList: case Array:
                    result = []
                    for (const f of value) result.push(this.flatten(f))
                    return result
                case DataTransfer:
                    result = { dropEffect: value.dropEffect, effectAllowed: value.effectAllowed, types: value.types }
                    Object.defineProperties(result, { files: { enumerable: true, get: () => this.flatten(value.files) }, items: { enumerable: true, get: () => this.flatten(value.items) } })
                    return result
                case FormData: return Object.fromEntries(value.entries())
                case Response:
                    result = { ok: value.ok, redirected: value.redirected, status: value.status, statusText: value.statusText, type: value.type, url: value.url }
                    Object.defineProperties(result, {
                        body: { enumerable: true, get: () => this.parse(value) }, bodyUsed: { enumerable: true, get: () => value.bodyUsed },
                        headers: { enumerable: true, get: () => Object.fromEntries(value.headers.entries()) }
                    })
                    return result
                case Object:
                    if (typeof value.valueOf === 'function') return value.valueOf()
                    result = {}
                    for (const k in value) result[k] = this.flatten(value[k])
                    return result
            }
            if (Array.isArray(value)) {
                result = []
                for (const v of value) result.push(this.flatten(v))
                return result
            } else if ((value instanceof Event) || this.isPlainObject(value)) {
                result = {}
                for (const k in value) result[k] = this.flatten(value[k])
                return result
            }
            if (value instanceof HTMLElement) {
                result = new Proxy({}, {
                    get(target, prop, receiver) {
                        const { elementMappers } = this.sys
                        if (prop in elementMappers) return elementMappers(value)
                        const propFlag = prop[0], propMain = prop.slice(1)
                        if (propFlag in elementMappers) return elementMappers(value, propMain)
                        if ((propFlag === '[') && propMain.endsWith(']')) return elementMappers.$form(value, propMain.slice(0, -1))
                        return this.flatten(value[prop])
                    },
                    has(target, key) {
                        const { elementMappers } = this.sys
                        if (prop in elementMappers) return elementMappers(value, prop) !== undefined
                        const propFlag = prop[0], propMain = prop.slice(1)
                        if (propFlag in elementMappers) return elementMappers(value, propMain) !== undefined
                        if ((propFlag === '[') && propMain.endsWith(']')) return elementMappers.$form(value, propMain.slice(0, -1)) !== undefined
                        return value[prop] !== undefined
                    }
                })
                return result
            }
            for (const p in this) if ((p.charCodeAt(0) <= 90) && (this[p].prototype instanceof this[p]) && value instanceof this[p]) return value.valueOf()
        }
    },
    generateUuid: {//optimal
        enumerable: true, value: function (noDashes) {
            if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()[noDashes ? 'replace' : 'toString'](this.sys.regexp.dash, '')
            return (noDashes ? 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx' : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(this.sys.regexp.xy, c => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4 + 8)) | 0).toString(16))
        }
    },
    isFacetContainer: { // optimal
        enumerable: true, value: function (element) {
            return ((element instanceof HTMLScriptElement) && element.type?.endsWith('/element'))
        }
    },
    isPlainObject: { // optimal
        enumerable: true, value: function (obj) {
            if (!obj) return false
            const proto = Object.getPrototypeOf(obj)
            return proto === null || proto === Object.prototype || proto.constructor === Object
        }
    },
    parse: {
        enumerable: true, value: async function (input, contentType) {
            const inputIsResponse = (input instanceof Response), inputIsText = (typeof input === 'text')
            if (!(inputIsResponse || inputIsText)) return input
            let inputUrlExtension
            if (!contentType && inputIsResponse) {
                const serverContentType = input.headers.get('Content-Type')
                if (serverContentType !== 'application/octet-stream') contentType = serverContentType || undefined
                if (!contentType) {
                    const inputUrlPathname = (new URL(input.url)).pathname, suffix = inputUrlPathname.includes('.') ? inputUrlPathname.split('.').pop() : undefined
                    contentType = suffix ? this.sys.suffixContentTypeMap[suffix] : undefined
                    if (contentType) inputUrlExtension = suffix
                }
                if (!contentType || (contentType === 'text/html') || (contentType === 'text/plain')) return await input.text()
            }
            if (!contentType) return input
            if (contentType === 'application/json') return (input instanceof Response) ? await input.json() : JSON.parse(input)
            let text = ((input instanceof Response) ? await input.text() : input).trim()
            if (contentType === 'text/css') return await (new CSSStyleSheet()).replace(text)
            if (contentType && contentType.includes('form')) return Object.fromEntries((new URLSearchParams(text)).entries())
            const contentTypeTransformer = this.resolveUnit(contentType, 'transform') ?? (inputUrlExtension ? this.resolveUnit(inputUrlExtension, 'transform') : undefined)
            if (contentTypeTransformer) return this.runTransform(contentTypeTransformer, text)
        }
    },



    render: { // optimal
        enumerable: true, value: async function (element, data) {
            if (!(element instanceof HTMLElement)) return
            element = this.app.components.natives.get(element) ?? element
            const tag = element.tagName.toLowerCase()
            switch (data) {
                case null: case undefined:
                    for (const p of ['checked', 'selected']) if (p in element) return element[p] = false
                    if ('value' in element) return element.value = ''
                    if (tag in this.sys.voidElementTags) return element.removeAttribute(this.sys.voidElementTags[tag])
                    return element.textContent = ''
                case true: case false:
                    for (const p of ['checked', 'selected', 'value']) if (p in element) return element[p] = data
                    if (tag in this.sys.voidElementTags) return element.toggleAttribute(this.sys.voidElementTags[tag])
                    return element.textContent = data
            }
            if (typeof data !== 'object') {
                for (const p of ['checked', 'selected']) if (p in element) return element[p] = !!data
                if ('value' in element) return element.value = data
                if (tag in this.sys.voidElementTags) return element.setAttribute(this.sys.voidElementTags[tag], data)
                return element[((typeof data === 'string') && this.sys.regexp.isHTML.text(data)) ? 'innerHTML' : 'textContent'] = data
            }
            const { elementMappers } = this.sys
            const promises = []
            for (const p in data) {
                if (p in elementMappers) { elementMappers[p](element, undefined, true, data[p]); continue }
                if (p.startsWith('::')) {
                    const position = p.slice(2)
                    if (typeof element[position] !== 'function') continue
                    let snippets = data[p]
                    if (!snippets) { element[position](snippets); continue }
                    if (!Array.isArray(snippets)) if (this.isPlainObject(snippets)) {
                        for (const snippetKey in snippets) promises.push(this.resolveSnippet(snippetKey).then(s => this.render(s, snippets[snippetKey])).then(s => element[position](...s)))
                        continue
                    } else snippets = [snippets]
                    if (!snippets.length) { element[position](); continue }
                    promises.push(this.resolveSnippet(snippets).then(s => element[position](...s)))
                    continue
                }
                const pFlag = p[0]
                if (pFlag === '&') {
                    let child = this.resolveScopedSelector(p, element)
                    if (!child) continue
                    if (!Array.isArray(child)) { this.render(child, data[p]); continue }
                    const useArray = Array.isArray(data[p]) ? [...data[p]] : undefined
                    for (const c of child) promises.push(this.render(c, useArray ? useArray.shift() : data[p]))
                }
                else if (pFlag in elementMappers) elementMappers[pFlag](element, p.slice(1).trim(), true, data[p])
                else if ((pFlag === '[') && p.endsWith(']')) elementMappers.$form(element, p.slice(1, -1).trim(), true, data[p])
                else if ((pFlag === '{') && p.endsWith('}')) elementMappers.$microdata(element, p.slice(1, -1).trim(), true, data[p])
                else if (typeof element[p] === 'function') element[p](data[p])
                else if (p.endsWith(')') && p.includes('(') && (typeof element[p.slice(0, p.indexOf('(')).trim()] === 'function')) {
                    let [functionName, argsList] = p.slice(0, -1).split('(')
                    functionName = functionName.trim()
                    argsList ||= '$'
                    if (typeof element[functionName] !== 'function') continue
                    argsList = argsList.trim().split(this.sys.regexp.commaSplitter)
                    const args = [], labels = { ...element.dataset }
                    promises.push(this.createEnvelope({ labels, value: data }).then(envelope => {
                        for (let a of argsList) args.push(this.resolveVariable(a, envelope))
                        element[functionName](...args)
                    }))
                }
                else element[p] = data[p]
            }
            return await Promise.all(promises)
        },
    },
    resolveScope: { // optimal
        enumerable: true, value: function (scopeStatement, element) {
            element = this.app.components.natives.get(element) ?? element
            if (!scopeStatement) return element.parentElement
            switch (scopeStatement) {
                case 'head': return document.head
                case 'body': return document.body
                case 'root': return element.getRootNode()
                case 'host': return element.getRootNode().host ?? document.documentElement
                case 'document': case 'html': return document.documentElement
                case 'window': return window
                case '*': case '&': case '@':
                    let scope = element.getRootNode()
                    switch (scopeStatement) {
                        case '*': return (scope === document) ? document.documentElement : scope
                        case '&': return (root instanceof ShadowRoot) ? scope : document.body
                        case '@': return (root instanceof ShadowRoot) ? scope : document.head
                    }
                default: return element.closest(scopeStatement)
            }
        }
    },
    resolveScopedSelector: { // optimal
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
    resolveSelector: {  // optimal
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
                                        if (remainingSegment[0] === '[') indexOfNextClause = remainingSegment.indexOf(']', 1) + 1
                                        else for (const c in this.sys.selector.clauseOpeners) if ((indexOfNextClause = remainingSegment.indexOf(c, 1)) !== -1) break
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
                                                        case '...': clauseInputValueType = 'textContent'
                                                        case '..': clauseInputValueType ??= 'innerText'
                                                        case '<>': clauseInputValueType ??= 'innerHTML'
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

    isWrappedVariable: { // optimal
        enumerable: true, value: function (expression) {
            return ((expression[0] === '$') && (expression[1] === '{') && (expression.endsWith('}')))
        }
    },

    resolveVariable: { // optimal
        enumerable: true, value: function (expression, envelope = {}, flags = {}) {
            expression = expression.trim()
            let result, { wrapped = false, default: dft = (!wrapped ? expression : undefined), spread, merge } = flags
            if (merge) {
                result = expression.replace(this.sys.regexp.hasVariable, (match, varExpression) => (this.resolveVariable(varExpression, envelope) ?? match))
            } else if (typeof expression === 'string') {
                if (wrapped || (wrapped === null)) {
                    const expressionIsWrapped = this.isWrappedVariable(expression)
                    if (wrapped && !expressionIsWrapped) return expression
                    wrapped ??= expressionIsWrapped
                }
                expression = expression.trim()
                if (wrapped) expression = expression.slice(2, -1).trim()
                const { context, cells, fields, labels, value } = envelope, e0 = expression[0]
                if (expression in this.sys.valueAliases) result = this.sys.valueAliases[expression]
                else if (expression === '$') result = 'value' in envelope ? value : expression
                else if ((e0 === '$') || (e0 === '@') || (e0 === '#') || (e0 === '~')) {
                    const subEnvelope = { '$': labels, '@': fields, '#': cells, '~': context }[e0]
                    if (subEnvelope === undefined) result = expression
                    else {
                        const [mainExpression, ...vectors] = expression.split('.'), l = vectors.length
                        let i = 0
                        result = subEnvelope[mainExpression.slice(1)]
                        while (result !== undefined && i < l) result = result?.[vectors[i++]]
                    }
                }
                else if ((e0 === '?') || ((e0 === '{') && expression.endsWith('}')) || ((e0 === '{') && expression.endsWith('}'))) {
                    result = this.resolveShape(expression)
                    if (context || cells || fields || labels || ('value' in envelope)) result = this.resolveVariable(expression, envelope, { ...flags, wrapped: false })
                }
                else if (((e0 === '"') && expression.endsWith('"')) || ((e0 === "'") && expression.endsWith("'"))) result = expression.slice(1, -1)
                else if (this.sys.regexp.isNumeric.test(expression)) result = expression % 1 === 0 ? parseInt(expression, 10) : parseFloat(expression)
                else result = expression
            } else if (Array.isArray(expression)) {
                result = []
                for (let i = 0, l = expression.length, a = spread && Array.isArray(dft); i < l; i++) result.push(this.resolveVariable(expression[i], envelope, { default: a ? dft[i] : dft }))
            } else if (this.isPlainObject(expression)) {
                result = {}
                const dftIsObject = spread && this.isPlainObject(dft)
                for (const key in expression) result[this.resolveVariable(key, envelope)] = this.resolveVariable(expression[key], envelope, { default: dftIsObject ? dft[key] : dft })
            }
            return result === undefined ? dft : result
        }
    },


    runUnit: { // optimal
        enumerable: true, value: async function (unitKey, unitType, ...args) {
            const unit = await this.resolveUnit(unitKey, unitType)
            return unit?.run(...args)
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
    toCamelCase: {
        enumerable: true, value: function (str) {
            return str.replace(this.sys.regexp.dashUnderscoreSpace, (_, c) => (c ? c.toUpperCase() : '')).replace(this.sys.regexp.nothing, (c) => c.toLowerCase())
        }
    },
    toKebabCase: {
        enumerable: true, value: function (str) {
            return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
        }
    },

    app: {
        value: Object.defineProperties({
            compile: undefined, components: { classes: {}, natives: new WeakMap(), bindings: new WeakMap(), virtuals: new WeakMap() }, dev: undefined,
            expose: undefined, facets: {}, gateways: {}, helpers: {}, hooks: {},
            interpreters: { matchers: new Map(), parsers: {}, binders: {}, handlers: {} }, namespaces: {},
            options: {}, patterns: {}, resolvers: {}, snippets: {}, transforms: {}, types: {}
        }, {
            cells: { value: {} },
            eventTarget: { value: new EventTarget() },
            facetInstances: { value: new WeakMap() },
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
            elementMappers: {
                '#': (el, w, v) => w ? (v == null ? el.removeAttribute('id') : (el.id = v)) : el.id,
                $attributes: function (el, p, w, v, options = {}) {
                    if (!(el && (el instanceof HTMLElement))) return
                    const { style, isComputed, get = 'getAttribute', set = 'setAttribute', remove = 'removeAttribute', defaultAttribute = 'name', toggle = 'toggleAttribute', filter } = options,
                        target = style ? (isComputed ? window.getComputedStyle(el) : el.style) : el, writable = style ? (w && !isComputed) : w
                    p &&= this.toKebabCase(p)
                    if (writable) {
                        if (p) return target[v == null ? remove : ((!style && (typeof v === 'boolean')) ? toggle : set)](p, v)
                        const vIsObject = typeof v === 'object'
                        if (vIsObject) for (const k in v) target[v[k] == null ? remove : ((!style && (typeof v[k] === 'boolean')) ? toggle : set)](this.toKebabCase(k), v[k])
                        if (vIsObject || style) return
                        p ||= defaultAttribute
                        return target[(typeof v === 'boolean') ? toggle : set](p, v)
                    }
                    if (p) return target[get](p)
                    const r = {}, iterator = style ? target : el.attributes
                    if (iterator.length) for (let i = 0, k, l = iterator.length; i < l; i++) {
                        k = iterator[i]
                        if (filter && !k.startsWith(filter)) continue
                        r[k] = target[get](k)
                        if (!style && (r[k] === '')) r[k] = true
                    }
                    return r
                },
                '@': '$attributes',
                $data: function (el, p, w, v, options = {}) {
                    const { filter = 'data-', defaultAttribute = 'data-value' } = options
                    if (!p && !(v && (typeof v === 'object'))) return v ? (el.value = v) : (el.value = '')
                    if (p && !p.startsWith(filter)) p = `${filter}${p}`
                    if (v && typeof v === 'object') for (const k in v) if (k && !k.startsWith(filter)) {
                        v[`${filter}${k}`] = v[k]
                        delete v[k]
                    }
                    return this.sys.elementMappers.$attributes(el, p, w, v, { defaultAttribute, filter })
                },
                '$': '$data',
                $aria: function (el, p, w, v) { return this.sys.elementMappers.$data(el, p, w, v, { defaultAttribute: 'aria-label', filter: 'aria-' }) },
                '*': '$aria',
                $style: function (el, p, w, v) { return this.sys.elementMappers.$attributes(el, p, w, v, { style: true, isComputed: false, get: 'getProperty', set: 'setProperty', remove: 'removeProperty' }) },
                '%': '$style',
                $computed: function (el, p, w, v) { return this.sys.elementMappers.$attributes(el, p, w, v, { style: true, isComputed: true, get: 'getProperty', set: 'setProperty', remove: 'removeProperty' }) },
                '&': '$computed',
                $inner: function (el, w, v) { return w ? (el[this.sys.regexp.isHTML.test(v) ? 'innerHTML' : 'textContent'] = v) : (this.sys.regexp.isHTML.test(el.textContent) ? el.innerHTML : el.textContent) },
                '.': '$inner',
                $content: (el, w, v) => w ? (el.textContent = v) : el.textContent,
                '..': '$content',
                $text: (el, w, v) => w ? (el.innerText = v) : el.innerText,
                '...': '$text',
                $html: (el, w, v) => w ? (el.innerHTML = v) : el.innerHTML,
                '<>': '$html',
                $tag: (el, p, w, v = 'is') => w ? (v == null ? el.removeAttribute(p) : (el.setAttribute(p, v.toLowerCase()))) : ((value.getAttribute(p) || value.tagName).toLowerCase()),
                $parent: function (el, p, w, v) {
                    el = this.app.components.natives.get(el) ?? el
                    return (w ?? v ?? p) ? undefined : this.flatten(el.parentElement)
                },
                '^': '$parent',
                $event: function (el, p, w, v, ev) { return (w ?? v) ? undefined : (p ? this.flatten(ev?.detail?.[p]) : this.flatten(ev)) },
                '!': '$event',
                $form: (el, p, w, v) => {
                    if (!(el instanceof HTMLElement)) return
                    const { tagName } = el, vIsNull = v == null, vIsObject = !vIsNull && (typeof v === 'object')
                    switch (tagName.toLowerCase()) {
                        case 'form': case 'fieldset':
                            if (p) return this.sys.elementMappers.$form(el.querySelector(`[name="${p}"]`), w, v)
                            if (!vIsObject) return
                            const r = {}
                            for (const fieldName in v) r[fieldName] = this.sys.elementMappers.$form(el.querySelector(`[name="${fieldName}"]`), w, v[fieldName])
                            return r
                        default:
                            const { type, name } = el
                            switch (type) {
                                case undefined: return
                                case 'checkbox': case 'radio':
                                    const inputs = el.closest('form,fieldset').querySelectorAll(`[name="${name}"][type=${type}]`)
                                    if (!inputs) return
                                    const isCheckbox = type === 'checkbox', isRadio = !isCheckbox
                                    if (w) {
                                        const vIsArray = Array.isArray(v), useV = vIsObject ? v : (vIsArray ? {} : { [v]: true })
                                        if (vIsArray) for (const f of v) useV[f] = true
                                        for (const c of inputs) if ((c.checked = !!useV[c.value]) && isRadio) return
                                        return
                                    }
                                    const r = isCheckbox ? [] : undefined
                                    if (isRadio) for (const f of inputs) if (f.checked) return f.value
                                    if (isRadio) return
                                    for (const f of inputs) if (f.checked) r.push(f.value)
                                    return r
                                default:
                                    return w ? (el.value = v) : el.value
                            }
                    }
                },
                '[]': '$form',
                $microdata: function (el, p, w, v) {
                    if (!((el instanceof HTMLElement) && el.hasAttribute('itemscope'))) return
                    if (p) {
                        const propElement = el.querySelector(`[itemprop="${p}"]`)
                        if (!propElement) return
                        return w ? this.render(propElement, v) : this.flatten(propElement)
                    }
                    if (w) if (this.isPlainObject(v)) for (const k in v) this.sys.elementMappers.$microdata(el, w, v[k], k)
                    if (w) return
                    const r = {}
                    for (const propElement of el.querySelectorAll('[itemprop]')) r[propElement.getAttribute('itemprop')] = this.flatten(propElement)
                    return r
                },
                '{}': '$microdata',
                $options: function (el, w, v) {
                    if (!((el instanceof HTMLSelectElement) || (el instanceof HTMLDataListElement))) return
                    if (w) {
                        const optionElements = []
                        if (v && (typeof v === 'object')) {
                            const vIsArray = Array.isArray(v), optionsMap = vIsArray ? {} : v
                            if (vIsArray) for (const f of v) optionsMap[f] = f
                            for (const k in optionsMap) {
                                const optionElement = document.createElement('option')
                                if (!vIsArray) optionElement.setAttribute('value', k)
                                optionElement.textContent = optionsMap[k]
                                optionElements.push(optionElement)
                            }
                        }
                        return el.replaceChildren(...optionElements)
                    }
                    const rObj = {}, rArr = []
                    let isMap
                    for (const optionElement of el.children) {
                        isMap ||= optionElement.hasAttribute('value')
                        const optionText = optionElement.textContent.trim(), optionValue = optionElement.getAttribute('value') || optionText
                        rObj[optionValue] = optionText
                        if (!isMap) rArr.push(optionText)
                    }
                    return isMap ? rObj : rArr
                },
                $table: function (el, p, w, v) {
                    if (!(el instanceof HTMLTableElement || el instanceof HTMLTableSectionElement)) return
                    if (w) {
                        if (!Array.isArray(v)) return
                        if (el instanceof HTMLTableElement) {
                            if (v.length === 0) return
                            const headers = Object.keys(v[0])
                            if (headers.length === 0) return
                            let thead = el.querySelector('thead')
                            if (!thead) {
                                thead = document.createElement('thead')
                                el.prepend(thead)
                            }
                            const headerRow = document.createElement('tr'), ths = []
                            for (const header of headers) {
                                const th = document.createElement('th')
                                th.textContent = header
                                ths.push(th)
                            }
                            headerRow.replaceChildren(...ths)
                            thead.replaceChildren(headerRow)
                            let tbody = el.querySelector('tbody')
                            if (!tbody) {
                                tbody = document.createElement('tbody')
                                el.appendChild(tbody)
                            }
                            const rows = []
                            for (const item of v) {
                                const tr = document.createElement('tr'), tds = []
                                for (const header of headers) {
                                    const td = document.createElement('td')
                                    td.textContent = item[header] !== undefined ? item[header] : ''
                                    tds.push(td)
                                }
                                tr.replaceChildren(...tds)
                                rows.push(tr)
                            }
                            tbody.replaceChildren(...rows)
                        } else if (el instanceof HTMLTableSectionElement && el.tagName.toLowerCase() === 'tbody') {
                            const rows = []
                            for (const rowData of v) {
                                const tr = document.createElement('tr'), tds = []
                                for (const cellData of rowData) {
                                    const td = document.createElement('td')
                                    td.textContent = cellData
                                    tds.push(td)
                                }
                                tr.replaceChildren(...tds)
                                rows.push(tr)
                            }
                            el.replaceChildren(...rows)
                        }
                        return
                    }
                    if (el instanceof HTMLTableElement) {
                        const thead = el.querySelector('thead'), tbody = el.querySelector('tbody')
                        if (!thead || !tbody) return []
                        const headers = [], rows = []
                        for (const th of thead.querySelectorAll('th')) headers.push(th.textContent.trim())
                        for (const tr of tbody.querySelectorAll('tr')) {
                            const cells = tr.querySelectorAll('td'), rowObj = {}
                            let index = -1
                            for (const header of headers) rowObj[header] = this.flatten(cells[++index])
                            rows.push(rowObj)
                        }
                        return rows
                    } else if (el instanceof HTMLTableSectionElement && el.tagName.toLowerCase() === 'tbody') {
                        const rows = []
                        for (const tr of el.querySelectorAll('tr')) {
                            const row = []
                            for (const td of tr.querySelectorAll('td')) row.push(this.flatten(td))
                            rows.push(row)
                        }
                        return rows
                    }
                    return
                },
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
                constructorFunction: /constructor\s*\(.*?\)\s*{[^}]*}/s, dashUnderscoreSpace: /[-_\s]+(.)?/g,
                directiveHandleMatch: /^([A-Z][A-Z0-9]*)::\s(.*)/, extractAttributes: /(?<=\[)([^\]=]+)/g,
                gatewayUrlTemplateMergeField: /{([^}]+)}/g,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isHTML: /<[^>]+>|&[a-zA-Z0-9]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/,
                isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi, jsonataHelpers: /\$([a-zA-Z0-9_]+)\(/g, leadingSlash: /^\/+/,
                nothing: /^(.)/,
                pipeSplitter: /(?<!\|)\|(?!\|)(?![^\[]*\])/, pipeSplitterAndTrim: /\s*\|\s*/, protocolSplitter: /\:\/\/(.+)/, dash: /-/g, xy: /[xy]/g,
                isRgb: /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/, isRgba: /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
                selectorBranchSplitter: /\s*,\s*(?![^"']*["'][^"']*$)/, selectorSegmentSplitter: /(?<=[^\s>+~|\[])\s+(?![^"']*["'][^"']*$)|\s*(?=\|\||[>+~](?![^\[]*\]))\s*/,
                spaceSplitter: /\s+/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g, tagMatch: /^[a-z0-9\-]+/g, isLocalUrl: /^(\.\.\/|\.\/|\/)/
            }),
            voidElementTags: Object.freeze({
                area: 'href', base: 'href', br: null, col: 'span', embed: 'src', hr: 'size', img: 'src', input: 'value', link: 'href', meta: 'content',
                param: 'value', source: 'src', track: 'src', wbr: null
            }),
            impliedScopes: Object.freeze({ ':': '*', '#': 'html' }),
            valueAliases: Object.freeze({ 'null': null, 'undefined': undefined, 'false': false, 'true': true, '-': null, '?': undefined, '!': false, '.': true }),
            autoResolverSuffixes: Object.freeze({
                component: ['html'], gateway: ['js', 'wasm'], helper: ['js', 'wasm'], snippet: ['html'], syntax: ['js', 'wasm'],
                transform: ['js', 'wasm', 'jsonata'], type: ['js', 'x', 'schema.json', 'json']
            }),
            suffixContentTypeMap: Object.freeze({
                html: 'text/html', css: 'text/css', md: 'text/markdown', csv: 'text/csv', txt: 'text/plain', json: 'application/json', yaml: 'application/x-yaml', jsonl: 'application/x-jsonl',
            }),
            locationKeyMap: { '#': 'hash', '/': 'pathname', '?': 'search' },
            windowEvents: ['beforeinstallprompt', 'beforeunload', 'appinstalled', 'offline', 'online', 'visibilitychange', 'pagehide', 'pageshow'],
            unitTypeMap: Object.freeze({
                api: ['apis', 'API'], component: ['components', 'Component'], content: ['content', 'Collection'], context: ['context', Object], facet: ['facets', 'Facet'], gateway: ['gateways', 'Gateway'],
                hook: ['hooks', Function], interpreter: ['interpreters', Object], language: ['languages', 'Language'], library: ['libraries', Object], ai: ['ais', 'AI'],
                namespace: ['namespaces', URL], pattern: ['patterns', RegExp], resolver: ['resolvers', Function], snippet: ['snippets', HTMLElement], transform: ['transforms', 'Transform'],
                type: ['types', 'Type']
            }),
            unitTypeCollectionNameToUnitTypeMap: Object.freeze({
                apis: 'api', components: 'component', content: 'content', context: 'context', facets: 'facet', gateways: 'gateway', hooks: 'hook',
                interpreters: 'interpreter', languages: 'language', libraries: 'library', ais: 'ai', namespaces: 'namespace', patterns: 'pattern', resolvers: 'resolver',
                snippets: 'snippet', transforms: 'transform', types: 'type'
            })
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
    attachUnitTypeCollection: { // optimal
        value: async function (unitTypeCollection, unitTypeCollectionName, packageUrl, packageKey, pkg) {
            if (typeof unitTypeCollection === 'function') unitTypeCollection = await unitTypeCollection(this, pkg)
            if (!this.env[unitTypeCollectionName]) return
            if (unitTypeCollectionName === 'interpreters') {
                if (!(unitTypeCollection instanceof Map)) return
                let allValid = true
                for (const [matcher, interpreter] of unitTypeCollection) {
                    allValid = (matcher instanceof RegExp) && isPlainObject(interpreter)
                        && interpreter.name && (typeof interpreter.name === 'string') && (typeof interpreter.parser === 'function') && (typeof interpreter.handler === 'function')
                        && (!interpreter.binder || (typeof interpreter.binder === 'function'))
                    if (!allValid) break
                    interpreter.name = `${packageKey}-${interpreter.name}`
                    for (const p of ['parser', 'handler', 'binder']) if (interpreter[p]) interpreter[p] = interpreter[p].bind(this)
                    Object.freeze(interpreter)
                }
                if (!allValid) return
                return this.env.interpreters = new Map([...this.env.interpreters, ...unitTypeCollection])
            }
            if (!this.isPlainObject(unitTypeCollection)) return
            const promises = [], unitType = this.sys.unitTypeCollectionNameToUnitTypeMap[unitTypeCollectionName],
                [, unitClassName] = this.sys.unitTypeMap[unitType], unitClass = typeof unitClassName === 'string' ? this[unitClassName] : unitClassName
            for (const unitKey in unitTypeCollection) {
                promises.push(Promise.resolve(unitTypeCollection[unitKey]).then(async unit => {
                    if (unit instanceof unitClass) return this.env[unitTypeCollectionName][unitKey] = unit
                    if (typeof unit === 'function') unit = await unit(this)
                    if (unit instanceof unitClass) return this.env[unitTypeCollectionName][unitKey] = unit
                    if (typeof unit === 'string') return this.env[unitTypeCollectionName][unitKey] = this.resolveUrl(unit, packageUrl)
                    if (this.isPlainObject(unit)) return this.env[unitTypeCollectionName][unitKey] = new unitClass(unit)
                }))
            }
            return Promise.all(promises)
        }
    },
    buildCatchallSelector: { // optimal
        value: function (selector) {
            const selectorMain = selector.slice(1)
            if (!selectorMain) return selector
            return `${selectorMain},[is="${selectorMain}"],e-${selectorMain},[is="e-${selectorMain}"]`
        }
    },
    createEnvelope: { // optimal
        enumerable: true, value: async function (baseObj = {}) {
            if (!this.isPlainObject(baseObj)) baseObj = { value: baseObj }
            return Object.freeze({ ...baseObj, cells: Object.freeze(this.flatten(this.app.cells)), context: this.env.context })
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
    getCustomTag: { // optimal
        value: function (element) {
            let tag = (element instanceof HTMLElement) ? (element.getAttribute('is') || element.tagName).toLowerCase() : `${element}`.toLowerCase()
            return tag.includes('-') ? tag : undefined
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
                const { gateway, head = gateway, auto, ctx } = manifest
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

    mountElement: { // optimal
        value: async function (element) {
            if (this.isFacetContainer(element)) return this.mountFacet(element)
            const customTag = this.getCustomTag(element)
            if (customTag) {
                await this.activateTag(customTag, element)
                const isAttr = element.getAttribute('is')
                if (isAttr) {
                    const componentInstance = this.app.components.virtuals.set(element, document.createElement(isAttr)).get(element)
                    for (const a of element.attributes) componentInstance.setAttribute(a.name, a.value)
                    if (element.innerHTML != undefined) componentInstance.innerHTML = element.innerHTML
                    this.app.components.natives.set(componentInstance, element)
                    if (typeof componentInstance.connectedCallback === 'function') componentInstance.connectedCallback()
                    if (componentInstance.disconnectedCallback || componentInstance.adoptedCallback || componentInstance.attributeChangedCallback) {
                        const observer = new MutationObserver(mutations => {
                            for (const mutation of mutations) {
                                switch (mutation.type) {
                                    case 'childList':
                                        for (const removedNode of (mutation.removedNodes ?? [])) {
                                            if (typeof componentInstance.disconnectedCallback === 'function') componentInstance.disconnectedCallback()
                                            if ((typeof componentInstance.adoptedCallback === 'function') && removedNode.ownerDocument !== document) componentInstance.adoptedCallback()
                                        }
                                        break
                                    case 'attributes': componentInstance.setAttribute(mutation.attributeName, mutation.target.getAttribute(attrName)); break
                                    case 'characterData': componentInstance.innerHTML = element.innerHTML; break
                                }
                            }
                        })
                        observer.observe(element, { childList: true, subtree: false, attributes: true, attributeOldValue: true, characterData: true })
                        this.app.components.bindings.set(element, observer)
                    }
                }
                const root = (element.shadowRoot || (element === document.documentElement)) ? (element.shadowRoot ?? element) : undefined
                if (root) {
                    const observer = new MutationObserver(mutations => {
                        for (const mutation of mutations) {
                            for (const addedNode of (mutation.addedNodes || [])) this.mountElement(addedNode)
                            for (const removedNode of (mutation.removedNodes || [])) this.unmountElement(removedNode)
                        }
                    })
                    observer.observe(root, { subtree: true, childList: true })
                    this.app.observers.set(root, observer)
                }
            }
            const promises = []
            if (element.shadowRoot?.children) for (const n of element.shadowRoot.children) promises.push(this.mountElement(n))
            for (const n of element.children) promises.push(this.mountElement(n))
            return Promise.all(promises)
        }
    },

    mountFacet: { // optimal
        value: async function (facetContainer) {
            let { type } = facetContainer, FacetClass, facetCid
            const src = facetContainer.getAttribute('src')
            if (type === 'facet/element') type = src ? 'application/element' : 'directives/element'
            switch (type) {
                case 'directives/element':
                    if (!this.modules.compile) return
                    const directives = await this.modules.compile.canonicalizeDirectives(src ? await fetch(this.resolveUrl(src)).then(r => r.text()) : facetContainer.textContent)
                    if (!directives) break
                    facetCid = await this.modules.compile.digest(directives)
                    this.app.facets[facetCid] ??= await this.modules.compile.facet(directives, facetCid)
                    break
                case 'application/element':
                    if (!src || this.app.facets[src]) break
                    FacetClass = (this.env.facets[src]?.prototype instanceof this.Facet) ? this.env.facets[src] : (await import(this.resolveUrl(src)))
                    FacetClass.E ??= this
                    FacetClass.prototype.E ??= this
                    facetCid = FacetClass.cid
                    this.app.facets[facetCid] = FacetClass
                    break
            }
            FacetClass ??= this.app.facets[facetCid]
            if (!(FacetClass?.prototype instanceof this.Facet)) return
            if (this.modules.dev) facetContainer.dataset.facetCid = facetCid
            const facetInstance = new FacetClass()
            this.app.facetInstances.set(facetContainer, facetInstance)
            const rootNode = facetContainer.getRootNode(), fields = {}, cells = {},
                context = Object.freeze(rootNode instanceof ShadowRoot ? { ...this.env.context, ...Object.fromEntries(Object.entries(rootNode.host.dataset)) } : this.env.context)
            for (const fieldName of FacetClass.fieldNames) fields[fieldName] = (new this.Field(facetInstance, fieldName))
            for (const cellName of FacetClass.cellNames) cells[cellName] = new this.Cell(cellName)
            Object.freeze(fields)
            Object.freeze(cells)
            facetInstance.observer = new MutationObserver(() => facetInstance.disabled = facetContainer.hasAttribute('disabled'))
            facetInstance.observer.observe(facetContainer, { attributes: true, attributeFilter: ['disabled'] })
            facetInstance.disabled = facetContainer.hasAttribute('disabled')
            await facetInstance.run(facetContainer, Object.freeze({ fields, cells, context }))
        }
    },
    processQueue: { // optimal
        value: async function () {
            for (const job of this.queue.values()) job.run()
            await new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100))
            this.processQueue()
        }
    },
    resolveImport: { //optimal
        enumerable: true, value: async function (importHref, returnWholeModule, isWasm) {
            const { hash = '#default', origin, pathname } = (importHref instanceof URL) ? importHref : this.resolveUrl(importHref, undefined, true), url = `${origin}${pathname}`
            isWasm ??= pathname.endsWith('.wasm')
            const module = isWasm ? (await WebAssembly.instantiateStreaming(fetch(url))).instance.exports : await import(url)
            return returnWholeModule ? module : module[hash.slice(1)]
        }
    },

    resolveSnippet: {
        value: async function (snippet) {
            const nodes = []
            if (Array.isArray(snippet)) {
                let promises = []
                for (const s of snippet) promises.push(this.resolveSnippet(s))
                promises = await Promise.all(promises)
                for (const p of promises) nodes.push(...p)
                return nodes
            }
            const { snippets: appSnippets } = this.app
            if (typeof snippet === 'string' && snippet[0] === '$') snippet = this.resolveVariable(snippet, await this.createEnvelope(), { wrapped: true, default: snippet.slice(2, -1), })
            if (snippet instanceof HTMLTemplateElement) nodes.push(...snippet.content.cloneNode(true).children)
            else if ((snippet instanceof Node) || (snippet instanceof HTMLElement)) nodes.push(snippet)
            else if ((snippet instanceof NodeList) || (snippet instanceof HTMLCollection)) nodes.push(...snippet)
            else if (typeof snippet === 'string') {
                if (appSnippets[snippet]) nodes.push(...appSnippets[snippet].content.cloneNode(true).children)
                else if (this.env.snippets[snippet]) nodes.push(...(appSnippets[snippet] = this.env.snippets[snippet]).content.cloneNode(true).children)
                else if (snippet[0] === '`' && snippet.endsWith('`')) {
                    const resolvedSnippet = await this.resolveUnit(snippet.slice(1, -1).trim(), 'snippet')
                    if (resolvedSnippet instanceof HTMLTemplateElement) nodes.push(...(appSnippets[snippet] = resolvedSnippet).content.cloneNode(true).children)
                }
                else {
                    const template = document.createElement('template')
                    template.innerHTML = snippet
                    nodes.push(...template.content.cloneNode(true).children)
                }
            }
            return nodes
        }
    },

    resolveUnit: { // optimal
        value: async function (unitKey, unitType) {
            if (!unitKey || !unitType) return
            const [unitTypeCollectionName, unitClassName] = this.sys.unitTypeMap[unitType], unitClass = typeof unitClassName === 'string' ? this[unitClassName] : unitClassName
            if (typeof unitKey !== 'string') return (unitKey instanceof unitClass) ? unitKey : undefined
            if (!(unitKey = unitKey.trim())) return
            if (unitType === 'resolver') return this.defaultResolver
            if (this.app[unitTypeCollectionName][unitKey]) return this.app[unitTypeCollectionName][unitKey]
            const unitQueueJob = this.queue.get(`${unitType}:${unitKey}`) ?? this.queue.get(`${unitTypeCollectionName}:${unitKey}`)
            if (unitQueueJob) {
                await unitQueueJob.completed()
                if (this.app[unitTypeCollectionName][unitKey]) return this.app[unitTypeCollectionName][unitKey]
            }
            const envUnit = this.env[unitTypeCollectionName][unitKey]
            let unitResolver
            if (envUnit) {
                if (typeof envUnit === 'string') unitResolver = await this.resolveUnit(unitType, 'resolver') ?? this.defaultResolver
                return this.app[unitTypeCollectionName][unitKey] = unitResolver ? await unitResolver(envUnit) : envUnit
            }
            unitResolver ??= await this.resolveUnit(unitType, 'resolver') ?? this.defaultResolver
            return this.app[unitTypeCollectionName][unitKey] = await unitResolver(unitKey)
        }
    },

    defaultResolver: { // optimal
        enumerable: true, value: async function (unitKey) {
            let unitUrl
            switch (unitKey[0]) {
                case '.': case '/': unitUrl = this.resolveUrl(unitKey, undefined, true); break
                default:
                    if (unitUrl.includes('://')) try { unitUrl = this.resolveUrl(new URL(unitKey).href, undefined, true) } catch (e) { }
                    else unitUrl = this.resolveUrl(`${unitTypeCollectionName}/${unitKey}`, undefined, true)
            }
            if (!unitUrl) return
            let unitSuffix
            for (const s of this.sys.autoResolverSuffixes[unitType]) {
                if (unitUrl.patname.endsWith(`.${s}`)) { unitSuffix = s; break }
                const testPath = `${unitUrl.pathname}.${s}`, testUrl = `${unitUrl.protocol}//${unitUrl.host}${testPath}`
                if ((await fetch(testUrl, { method: 'HEAD' })).ok) {
                    unitUrl.pathname = testPath
                    unitSuffix = s
                    break
                }
            }
            if (!unitSuffix) return
            let unitModule, unit
            if (unitUrl) {
                switch (unitSuffix) {
                    case 'js': case 'wasm': unit = this.resolveImport(unitUrl); break
                    case 'json':
                        unitModule = await (await fetch(unitUrl.href)).json()
                    default:
                        if (!unitModule) unitModule = (await this.parse(unitModule = (await fetch(unitUrl.href)))) ?? (await unitModule.text())
                        const { hash } = unitUrl
                        unit = hash ? ((unit && typeof unit === 'object') ? unit[hash] : undefined) : unitModule
                }
            }
            return unit
        }
    },


    runHook: { // optimal
        enumerable: true, value: async function (hookName) {
            if (!this.app.hooks[hookName]) {
                if (!this.env.hooks[hookName]) return
                this.app.hooks[hookName] = {}
                const promises = []
                for (const packageKey in this.env.hooks[hookName]) {
                    let hookFunction = this.env.hooks[hookName][packageKey]
                    if (typeof hookFunction === 'string') promises.push(this.resolveUnit(hookFunction, 'hook').then(hookFunction => { if (typeof hookFunction === 'function') this.app.hooks[hookName][packageKey] = hookFunction }))
                    if (typeof hookFunction === 'function') this.app.hooks[hookName][packageKey] = hookFunction
                }
                await Promise.all(promises)
            }
            if (!this.app.hooks[hookName]) return
            const envelope = this.createEnvelope()
            for (const packageKey in this.app.hooks[hookName]) this.app.hooks[hookName][packageKey](envelope)
        }
    },
    sliceAndStep: { // optimal
        value: function (sig, list) {
            if (!Array.isArray(list)) return list
            if (!sig.includes(':')) return [list[parseInt(sig) || 0]]
            let [start = 0, end = list.length, step = 0] = sig.split(':').map(Number)
            list = list.slice(start || 0, end || list.length)
            if (!step) return list
            const newList = []
            for (let i = 0, l = list.length; i < l; i += step) newList.push(list[i])
            return newList
        }
    },
    unmountElement: { // optimal
        value: async function (element) {
            if (!(element instanceof HTMLElement)) return
            if (this.isFacetContainer(element)) return this.unmountFacet(element)
            if (element.children.length) {
                const promises = []
                for (const n of element.children) promises.push(this.unmountElement(n))
                await Promise.all(promises)
            }
            if ((typeof element.disconnectedCallback === 'function') && this.getCustomTag(element)) element.disconnectedCallback()
        }
    },
    unmountFacet: { // optimal
        value: function (facetContainer) {
            const facetInstance = this.app.facetInstances.get(facetContainer)
            for (const p in facetInstance.controllers) facetInstance.controllers[p].abort()
            facetInstance.controller.abort()
            facetInstance.observer.disconnect()
        }
    },
    queue: { value: new Map() },

    AI: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ api, model, promptTemplates = {} }) {
                if (!api) return
                const { E } = this.constructor
                if (E.isPlainObject(promptTemplates)) this.promptTemplates = promptTemplates
                if (model) {
                    switch (typeof model) {
                        case 'function': this.modelWrapper = model.bind(this); break
                        case 'string':
                            this.modelWrapper = async (input, envelope) => (await (this.model ??= await E.resolveUnit(model, 'model')).run(input))
                            new E.Job(async function () { await E.resolveUnit(model, 'model') }, `model:${model}`)
                            break
                        case 'object':
                            if (model instanceof E.Model) this.modelWrapper = async (input, envelope) => (await (this.model ??= model).run(input))
                            else if (E.isPlainObject(model)) this.modelWrapper = async (input, envelope) => (await (this.model ??= new E.Model(model)).run(input))
                    }
                    if (!this.modelWrapper) return
                    this.engine = this.modelWrapper
                } else if (api) {
                    switch (typeof api) {
                        case 'function': this.apiWrapper = api.bind(this); break
                        case 'string':
                            this.apiWrapper = async (input, envelope) => (await (this.api ??= await E.resolveUnit(api, 'api')).run(input))
                            new E.Job(async function () { await E.resolveUnit(api, 'api') }, `api:${api}`)
                            break
                        case 'object':
                            if (api instanceof E.API) this.apiWrapper = async (input, envelope) => (await (this.api ??= api).run(input))
                            else if (E.isPlainObject(api)) this.apiWrapper = async (input, envelope) => (await (this.api ??= new E.API(api)).run(input))
                    }
                    if (!this.apiWrapper) return
                    this.engine = this.apiWrapper
                }
            }
            async run(input, promptTemplateKey, envelope) {
                const { E } = this.constructor
                if (typeof input === 'string') {
                    const promptTemplate = promptTemplateKey ? (this.promptTemplates[promptTemplateKey] ?? '$') : '$'
                    input = E.resolveVariable(promptTemplate, { ...envelope, value: input }, { merge: true })
                }
                return this.engine(input, envelope)
            }
        }
    },
    API: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ base = '.', actions = {}, options = {}, contentType = 'application/json', acceptType, preProcessor, postProcessor, errorProcessor }) {
                const { E } = this.constructor
                Object.assign(this, { E, base: this.resolveUrl(base), actions, options, contentType, acceptType, preProcessor, postProcessor, errorProcessor })
                this.acceptType ??= this.contentType
                new Job(async function () { await this.resolveUnit(this.contentType, 'transformer') }, `transformer:${this.contentType}`)
                if (this.acceptType && (this.acceptType !== this.contentType)) new Job(async function () { await this.resolveUnit(this.acceptType, 'transformer') }, `transformer:${this.acceptType}`)
                if (this.preProcessor) new Job(async function () { await this.resolveUnit(this.preProcessor, 'transformer') }, `transformer:${this.preProcessor}`)
                if (this.postProcessor) new Job(async function () { await this.resolveUnit(this.postProcessor, 'transformer') }, `transformer:${this.postProcessor}`)
                if (this.errorProcessor) new Job(async function () { await this.resolveUnit(this.errorProcessor, 'transformer') }, `transformer:${this.errorProcessor}`)
                if (this.actions) Object.freeze(this.actions)
                if (this.options) Object.freeze(this.options)
            }
            async run(value, action, valueEnvelope) {
                const { E } = this
                if (this.preProcessor) value = await E.runUnit(this.preProcessor, 'transform', value)
                action = (action ? this.actions[action] : undefined) ?? { pathname: `/${('pathname' in this.options) ? (this.options.pathname || '') : (action || '')}` }
                const options = {
                    ...this.options, ...(action?.options ?? {}),
                    method: action.method ?? ({ null: 'HEAD', false: 'DELETE', true: 'GET', undefined: 'GET' })[value] ?? this.options.method,
                    headers: { ...this.options.headers, ...(action?.options?.headers ?? {}) }
                }, merge = true, pathname = E.resolveVariable(action.pathname, valueEnvelope, { merge }),
                    url = E.resolveUrl(pathname, E.resolveVariable(this.base, valueEnvelope, { merge }))
                if (value === 0 || (value && typeof value !== 'string')) {
                    const contentType = options.headers['Content-Type'] ?? options.headers['content-type'] ?? action.contentType ?? this.contentType
                    options.body = await E.runUnit(contentType, 'transform', value)
                    if (typeof options.body !== 'string') throw new Error(`Input value unable to be serialzed to "${contentType}".`)
                }
                const response = await fetch(url, options)
                let result
                if (response.ok) {
                    const acceptType = options.headers.Accept ?? options.headers.accept ?? action.acceptType ?? this.acceptType
                    result = await E.runUnit(acceptType, 'transform', await response.text())
                    if (this.postProcessor) result = await E.runUnit(this.postProcessor, 'transform', result)
                } else if (this.errorProcessor) {
                    result = await E.runUnit(this.errorProcessor, 'transform', response)
                }
                return result
            }
        }
    },
    Collection: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ api = {}, ai = {} }) {
                const { E } = this.constructor
                switch (typeof api) {
                    case 'function': this.apiWrapper = api.bind(this); break
                    case 'string':
                        const [apiName, apiAction] = api.split(E.sys.regexp.pipeSplitterAndTrim)
                        this.apiWrapper = async (slug, envelope) => (await (this.api ??= await E.resolveUnit(apiName, 'api')).run(slug, apiAction, envelope))
                        new E.Job(async function () { await E.resolveUnit(apiName, 'api') }, `api:${apiName}`)
                        break
                    default:
                        if (E.isPlainObject(api)) {
                            api.contentType ??= 'text/markdown'
                            api.base ??= './content'
                            this.apiWrapper = async (slug, envelope) => (await (this.api ??= new E.API(api)).run(undefined, slug, envelope))
                        }
                }
                if (!this.apiWrapper) return
                if (ai) {
                    switch (typeof ai) {
                        case 'function': this.aiWrapper = ai.bind(this); break
                        case 'string':
                            const [aiName, aiPrompt] = ai.split(E.sys.regexp.pipeSplitterAndTrim)
                            this.aiWrapper = async (prompt) => (await (this.ai ??= await E.resolveUnit(aiName, 'ai')).run(prompt, aiPrompt, envelope))
                            new E.Job(async function () { await E.resolveUnit(aiName, 'ai') }, `ai:${aiName}`)
                            break
                        default:
                            if (E.isPlainObject(ai)) this.aiWrapper = async (prompt) => (await (this.api ??= new E.AI(engine)).run(prompt, undefined, envelope))
                    }
                    if (this.aiWrapper) this.engine = async (slug, envelope) => { return this.aiWrapper(E.resolveVariable(await this.apiWrapper(slug, envelope), envelope, { merge: true })) }
                }
                this.engine ??= this.apiWrapper
            }
            async run(slug, lang, envelope) {
                const { E } = this.constructor
                if (typeof slug === 'string') {
                    slug = E.resolveVariable(slug, envelope, { merge: true })
                    if (lang && typeof lang === 'string') slug = `${E.resolveVariable(lang, envelope, { merge: true })}/${slug}`
                }
                return this.engine(slug, envelope)
            }
        }
    },
    Component: {
        enumerable: true, value: class extends HTMLElement {
            static E
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
    Facet: { // optimal
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
            saveToLabel(stepIndex, label, value, labelMode, labels, fields, cells) {
                labels[`${stepIndex}`] = value
                if (label && (label != stepIndex)) {
                    switch (label[0]) {
                        case '@': fields[label.slice(1)].set(value, labelMode); break
                        case '#': cells[label.slice(1)].set(value, labelMode); break
                        default: labels[label] = value
                    }
                }
            }
            async run(container, { fields, cells, context }) {
                const { E, statements } = this.constructor, { interpreters } = E.env, interpreterKeys = interpreters.keys(), { controller, controllers, descriptors, saveToLabel, disabled } = this
                let statementIndex = -1
                for (const statement of statements) {
                    statementIndex++
                    const { steps = [] } = statement, labels = {}
                    for (const label of statement.labels) labels[label] = undefined
                    this.labels[statementIndex] = labels
                    let stepIndex = -1
                    for (const step of steps) {
                        stepIndex++
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, defaultExpression, signature } = step,
                            { interpreter: interpreterKey, variables } = signature, descriptor = { ...(signature.descriptor ?? {}) }, { signal } = descriptor,
                            envelope = { descriptor, labels, fields, cells, context, variables }
                        let interpreter, matcher
                        for (matcher of interpreterKeys) if (matcher.toString() === interpreterKey) break
                        if (matcher) interpreter = interpreters.get(matcher)
                        if (!interpreter) continue
                        const { binder, handler } = interpreter
                        if (signal) descriptor.signal = (controllers[position] = new AbortController()).signal
                        if (binder) Object.assign(descriptor, (await binder(container, position, envelope) ?? {}))
                        descriptors[position] = Object.freeze(descriptor)
                        container.addEventListener(`done-${position}`, async event => saveToLabel(stepIndex, label, event.detail, labelMode, labels, fields, cells), { signal: controller.signal })
                        const previousStepIndex = stepIndex ? stepIndex - 1 : undefined
                        container.addEventListener(stepIndex ? `done-${statementIndex}-${previousStepIndex}` : 'run', async () => {
                            if (disabled) return
                            const handlerEnvelope = { ...envelope, fields: Object.freeze(E.flatten(fields)), cells: Object.freeze(E.flatten(cells)), labels: Object.freeze({ ...labels }) },
                                value = previousStepIndex !== undefined ? labels[`${previousStepIndex}`] : undefined, detail = await handler(container, position, handlerEnvelope, value)
                                    ?? (defaultExpression ? E.resolveVariable(defaultExpression, { ...handlerEnvelope, value }) : undefined)
                            if (detail !== undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                        }, { signal: controller.signal })
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
    Gateway: {
        enumerable: true, value: class {
            static E
            fallbacks = []
            constructor(fallbacks) {
                if (!Array.isArray(fallbacks)) fallbacks = [fallbacks]
                for (let fallback of fallbacks) {
                    if (typeof fallback === 'string') fallback = { gateway: fallback }
                    if (!this.constructor.E.isPlainObject(fallback)) continue
                    this.fallbacks.push(fallback)
                }
            }
        }
    },
    Language: {
        enumerable: true, value: class {
            static E
            observers = new WeakMap()
            constructor({ lang, matches = {}, tokens = {} }) {
                const { E } = this.constructor
                Object.assign(this, { lang, matches, tokens })
                this.matches.textContent ??= '[data-lang-token-text-content]'
                this.matches['@title'] ??= '[data-lang-token-attr-title][title]'
                this.matches['@alt'] ??= 'img[data-lang-token-attr-alt][alt]'
                this.matches['@placeholder'] ??= 'input[data-lang-token-attr-placeholder][placeholder]'
                this.matches['@aria-label'] ??= '[data-lang-token-attr-aria-label][aria-label]'
                this.matches['@aria-labelledby'] ??= '[data-lang-token-attr-aria-labelledby][aria-labelledby]'
                this.matches['@aria-describedby'] ??= '[data-lang-token-attr-aria-describedby][aria-describedby]'
                this.matches['@value'] ??= 'input[data-lang-token-attr-value][value]'
                this.matches['@content'] ??= 'meta[name][data-lang-token-attr-content][content]'
                this.matches['@label'] ??= '[data-lang-token-attr-label][label]'
                const attributes = new Set(['lang']), selectors = {}
                for (const key in this.matches) {
                    const attributePair = this.matches[key].match(E.sys.regexp.extractAttributes), isAttr = key[0] === '@'
                    if (!attributePair.length || (isAttr && (attributePair.length < 2))) { delete this.matches[key]; continue }
                    for (const attrName of attributePair) attributes.add(attrName)
                    const selObj = { key, [isAttr ? 'target' : 'token']: attributePair.pop() }
                    if (isAttr) selObj.token = attributePair.pop()
                    selectors[this.matches[key]] = Object.freeze(selObj)
                }
                this.selectors = Object.freeze(selectors)
                this.attributeFilter = Array.from(attributes)
                Object.freeze(this.matches)
                Object.freeze(this.tokens)
            }
            applyTokens(node) {
                const nodeIsElement = node instanceof HTMLElement
                if (nodeIsElement && (node.closest('[lang]')?.getAttribute('lang') !== this.lang)) return
                else if (node.shadowRoot && (node.host.getAttribute('lang') !== this.lang)) return
                const { selectors } = this
                for (const selector in selectors) {
                    const nodeList = Array.from(node.querySelectorAll(selector)), { key, token, target } = selectors[selector]
                    if (nodeIsElement && node.matches(selector)) nodeList.push(node)
                    for (const n of nodeList) target ? n.setAttribute(target, n.getAttribute(token)) : (n[key] = n.getAttribute(token))
                }
            }
            supportLanguage(node) {
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'childList') for (const addedNode of mutation.addedNodes) if (addedNode.hasAttribute('lang') && (addedNode.getAttribute('lang') === this.lang)) this.supportLanguage(addedNode)
                        this.applyTokens(mutation.target)
                    }
                })
                observer.observe(node, { subtree: true, childList: true, attributeFilter: this.attributeFilter })
                this.observers.set(node, observer)
                this.applyTokens(node)
                if (node.shadowRoot) this.supportLanguage(node.shadowRoot)
            }
            run() {
                const langSelector = `[lang|="${this.lang}"]`, nodes = Array.from(document.querySelectorAll(langSelector))
                if (document.documentElement.matches(langSelector)) nodes.push(document.documentElement)
                for (const node of nodes) this.supportLanguage(node)
            }
        }
    },

    Transform: {
        enumerable: true, value: class {
            static E
            static embeddableUnitTypes = new Set('api', 'collection', 'ai', 'library')
            constructor(stepChain) {
                const { E } = this.constructor
                if (!Array.isArray(stepChain)) stepChain = [stepChain]
                this.steps = []
                this.stepIntermediates = []
                let index = 0
                for (const step of stepChain) {
                    if (!step) continue
                    else if (typeof step === 'function') this.steps.push(step.bind(E))
                    else if (step instanceof Promise) {
                        this.steps.push(async (input, valueEnvelope) => {
                            if (!this.stepIntermediates[index]) {
                                const stepResult = await step
                                if (typeof stepResult === 'function') stepResult = stepResult.bind(E)
                                this.stepIntermediates[index] = stepResult
                            }
                            const func = this.stepIntermediates[index]
                            return (typeof func === 'function') ? func(input, valueEnvelope) : func
                        })
                    }
                    else if (typeof step === 'string') {
                        this.steps.push(async (input, envelope) => {
                            const jsonata = (E.app.libraries.jsonata ??= await E.resolveUnit('jsonata', 'library')),
                                expression = this.stepIntermediates[index] ??= jsonata(`(${step.trim()})`)
                            return expression.evaluate(input, { envelope })
                        })
                    }
                    else if (this.isPlainObject(step) && (Object.keys(step).length === 1)) {
                        const { unitType, unitKey } = step.entries()[0]
                        if (!this.constructor.embeddableClasses.has(stepClassName)) continue
                        this.steps.push(async (input, envelope) => {
                            input = Array.isArray(input) ? input : [input, undefined]
                            const unit = await E.resolveUnit(unitType, unitKey)
                            return unit(...input, envelope)
                        })
                    }
                    index++
                }
            }
            async run(input, valueEnvelope) {
                for (const step of this.steps) {
                    if (input === undefined) break
                    input = await step(input, valueEnvelope)
                }
                return input
            }
        }
    },
    Type: {
        enumerable: true, value: class {
            static E
            constructor(typeDefinition, typeName) {
                const { E } = this.constructor
                if (!typeDefinition) return
                switch (typeof typeDefinition) {
                    case 'function': this.engine = typeDefinition.bind(E); break
                    case 'object':
                        if (typeDefinition instanceof E.Validator) {
                            this.engine = async (input, verbose, envelope) => {
                                const [valid, validation = {}] = await typeDefinition.test(input, verbose, envelope)
                                return verbose ? validation : valid
                            }
                        } else {
                            if (!this.isPlainObject(typeDefinition)) return
                            if (this.isPlainObject(typeDefinition.library) && Array.isArray(typeDefinition.types)) {
                                this.engine = async (input, verbose, envelope) => {
                                    const xdr = await E.resolveUnit('xdr', 'library')
                                    this.typeDefinition ??= await xdr.import(typeDefinition, undefined, {}, 'json')
                                    let valid = false, errors
                                    try { valid = !!xdr.serialize(input, this.typeDefinition) } catch (e) { errors = e }
                                    return verbose ? { input, typeName, valid, errors } : valid
                                }
                            } else {
                                this.engine = async (input, verbose, envelope) => {
                                    const jsonSchema = await E.resolveUnit('schema.json', 'library')
                                    if (!this.typeDefinition) {
                                        this.typeDefinition = new jsonSchema(typeDefinition)
                                        await this.typeDefinition.deref()
                                    }
                                    const valid = this.typeDefinition.validate(input)
                                    return verbose ? { input, typeName, valid, errors: valid ? undefined : this.typeDefinition.errors(input) } : valid
                                }
                            }
                        }
                        break
                    case 'string':
                        this.engine = async (input, verbose, envelope) => {
                            const xdr = await E.resolveUnit('xdr', 'library')
                            this.typeDefinition ??= await xdr.factory(typeDefinition, typeName)
                            let valid = false, errors
                            try { valid = !!xdr.serialize(input, this.typeDefinition) } catch (e) { errors = e }
                            return verbose ? { input, typeName, valid, errors } : valid
                        }
                }
            }
            run(input, verbose, envelope) {
                return this.engine(input, verbose, envelope)
            }
        }
    },

    State: { // optimal
        value: class {
            static E
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
    Validator: { // TODO: make this such that a type is an instance of Validator
        enumerable: true, value: class {
            static E

            constructor(obj) {
                if (!obj || (typeof obj !== 'object')) return
                for (const p in obj) if (typeof this[p] === 'function') Object.defineProperty(this, p, { enumerable: true, writable: false, value: this[p](obj[p]) })
            }

            valueOf() {
                return
                let valid
                for (const k in this) if (!(valid = (this[k] === true))) break
                return valid
            }
        }
    },
    Job: { // optimal
        enumerable: true, value: class {
            static E
            running = false
            static cancelJob(id) { return this.constructor.E.queue.delete(id) }
            static isRunning(id) { return this.constructor.E.queue.get(id)?.running }
            static getJobFunction(id) { return this.constructor.E.queue.get(id)?.jobFunction }
            static getJobRunner(id) { return this.constructor.E.queue.get(id)?.runner }
            constructor(jobFunction, id) {
                const { E } = this.constructor, { queue } = E
                if (typeof jobFunction !== 'function') return
                this.id = id ?? E.generateUuid()
                if (queue.get(this.id)) return
                this.jobFunction = jobFunction
                queue.set(this.id, this)
            }
            cancel() { this.constructor.E.queue.delete(this.id) }
            complete(deadline = 1000) {
                const { E } = this.constructor, { queue } = E
                if (!queue.has(this.id)) return
                const timeoutFunc = window.requestIdleCallback ?? window.setTimeout, timeoutArg = window.requestIdleCallback ? undefined : 1, now = Date.now()
                deadline = now + deadline
                let beforeDeadline = (now < deadline)
                return new Promise((async res => {
                    while (beforeDeadline && queue.has(this.id)) {
                        await new Promise(resolve => timeoutFunc(resolve, timeoutArg))
                        beforeDeadline = (Date.now() < deadline)
                    }
                    res(!queue.has(this.id))
                }))
            }
            async run() { if (!this.running) return this.runner() }
            async runner() {
                if (this.running) return
                this.running = true
                try { await this.jobFunction.call(this.constructor.E) } finally { this.cancel() }
            }
        }
    },
})
Object.defineProperties(ElementHTML, {
    Cell: { // optimal
        enumerable: true, value: class extends ElementHTML.State {
            constructor(name, initialValue) {
                const { cells } = ElementHTML.app
                if (name && cells[name]) return cells[name]
                super(name, initialValue)
                if (this.name) cells[this.name] ??= this
            }
        }
    },
    Field: { // optimal
        enumerable: true, value: class extends ElementHTML.State {
            constructor(facetInstanceOrContainer, name, initialValue) {
                let fields = (facetInstanceOrContainer instanceof ElementHTML.Facet) ? facetInstanceOrContainer.fields : ((facetInstanceOrContainer instanceof HTMLElement) ? ElementHTML.app.facetInstances.get(facetInstanceOrContainer).fields : undefined)
                if (name && fields[name]) return fields[name]
                super(name, initialValue)
                if (name && fields) fields[name] ??= this
            }
        }
    }
})
for (const className of ['API', 'Collection', 'Component', 'Facet', 'Gateway', 'Job', 'Language', 'Transform', 'Type', 'Validator']) ElementHTML[className].E = ElementHTML
for (const f in ElementHTML.sys.color) ElementHTML.sys.color[f] = ElementHTML.sys.color[f].bind(ElementHTML)
for (const c in ElementHTML.sys.selector) for (const f in ElementHTML.sys.selector[c]) if (typeof ElementHTML.sys.selector[c][f] === 'function')
    ElementHTML.sys.selector[c][f] = ElementHTML.sys.selector[c][f].bind(ElementHTML)
for (const f in ElementHTML.sys.elementMappers) ElementHTML.sys.elementMappers[f] = typeof ElementHTML.sys.elementMappers[f] === 'string'
    ? (ElementHTML.sys.elementMappers[f] = ElementHTML.sys.elementMappers[ElementHTML.sys.elementMappers[f]].bind(ElementHTML)) : ElementHTML.sys.elementMappers[f].bind(ElementHTML)

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