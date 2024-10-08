const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '2.0.0' }, // optimal

    env: { // optimal
        enumerable: true, value: {
            ais: {}, apis: {}, components: {}, content: {}, context: {}, facets: {}, gateways: {}, hooks: {},
            interpreters: new Map([
                [/^[#?/:]$/, {
                    name: 'router',
                    handler: async function (container, position, envelope, value) {
                        const { sys } = this, { location } = document, { descriptor } = envelope, { expression } = descriptor
                        let result
                        if (expression in sys.locationKeyMap) {
                            const locationKey = sys.locationKeyMap[expression]
                            if (typeof value === 'string') location[locationKey] = value
                            return location[locationKey].slice(1) || undefined
                        }
                        if (expression !== ':') return
                        if (value !== undefined) await this.runFragment('env/interpreters/router', value)
                        result = {}
                        for (const k in location) if (typeof location[k] !== 'function') result[k] = location[k]
                        result.ancestorOrigins = Array.from(result.ancestorOrigins)
                        result.path = result.pathname.replace(sys.regexp.leadingSlash, '')
                        return result
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { signal } = descriptor
                        if (signal) window.addEventListener('hashchange', () => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash.slice(1) })), { signal })
                    }
                }],
                [/^(true|false|null|[.!-]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(\.\d+)?)$/, {
                    name: 'value',
                    handler: async function (container, position, envelope, value) { return envelope.descriptor.value }
                }],
                [/^\$\{.*\}$/, {
                    name: 'variable',
                    handler: async function (container, position, envelope, value) { return this.resolveVariable(descriptor.expression, Object.freeze({ ...envelope, value })) }
                }],
                [/^[{](.*?)[}]$|^[\[](.*?)[\]]$|^\?[^ ]+$/, {
                    name: 'shape',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor } = envelope
                        return this.resolveVariable(descriptor.shape, Object.freeze({ ...envelope, value }))
                    }
                }],
                [/^#\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'content',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, variables } = envelope, { collection: a, article: articleSignature, lang: langSignature } = descriptor, wrapped = variables && true,
                            valueEnvelope = variables && Object.freeze({ ...envelope, value }),
                            collection = await this.resolveUnit(variables?.collection ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'collection')
                        if (!collection) return
                        const vArticle = variables?.article, article = vArticle ? this.resolveVariable(articleSignature, valueEnvelope, { wrapped }) : articleSignature
                        if (vArticle && !article) return
                        const lang = variables?.lang ? this.resolveVariable(langSignature, valueEnvelope, { wrapped }) : langSignature
                        return collection.run(article, lang ?? container.lang, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { collection: collectionSignature } = descriptor
                        if (!variables?.collection) new Job(async function () { await this.resolveUnit(collectionSignature, 'collection') }, `collection:${collectionSignature}`)
                    }
                }],
                [/^\(.*\)$/, {
                    name: 'transform',
                    handler: async function (container, position, envelope, value) {
                        let { descriptor, variables } = envelope, { transform: t } = descriptor, vTransform = variables?.transform, wrapped = vTransform && true,
                            valueEnvelope = vTransform ? Object.freeze({ ...envelope, value }) : envelope,
                            transform = await this.resolveUnit(vTransform ? this.resolveVariable(t, valueEnvelope, { wrapped }) : t, 'transform')
                        return transform?.run(value, container, valueEnvelope)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { transform: transformSignature } = descriptor
                        if (!variables?.transform) new Job(async function () { await this.resolveUnit(transformSignature, 'transform') }, `transform:${transformSignature}`)
                    }
                }],
                [/^\/.*\/$/, {
                    name: 'pattern',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor, variables } = envelope, { pattern: p } = descriptor, wrapped = variables && true,
                            valueEnvelope = variables ? Object.freeze({ ...envelope, value }) : undefined,
                            pattern = await this.resolveUnit(variables.pattern ? this.resolveVariable(p, valueEnvelope, { wrapped }) : p, 'pattern')
                        if (!(pattern instanceof RegExp)) return
                        pattern.lastIndex &&= 0
                        const match = value.match(pattern), groups = match?.groups
                        return groups ? Object.fromEntries(Object.entries(groups)) : (match ? match[1] : undefined)
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { pattern: patternSignature } = descriptor
                        if (!variables?.pattern) new Job(async function () { await this.resolveUnit(patternSignature, 'pattern') }, `pattern:${patternSignature}`)
                    }
                }],
                [/^\|.*\|$/, {
                    name: 'type',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor } = envelope, { types, mode } = descriptor, info = mode === 'info', promises = [], wrapped = true, valueEnvelope = { ...envelope, value }
                        for (const t of types) if (this.isWrappedVariable(t.name)) promises.push(this.resolveUnit(this.resolveVariable(t.name, valueEnvelope, { wrapped }), 'type'))
                        await Promise.all(promises)
                        let pass = info
                        if (info) {
                            const validation = {}, promises = []
                            for (const { name } of types) promises.push(this.runUnit(name, 'type', value, true).then(r => validation[name] = r))
                            await Promise.all(promises)
                            return { value, validation }
                        }
                        const [any, all] = [mode === 'any', mode === 'all']
                        for (const { if: ifMode, name } of types) if (pass = (ifMode === (await this.runUnit(name, 'type', value)))) { if (any) break; } else if (all) break
                        if (pass) return value
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { types } = descriptor
                        for (t of types) if (!this.isWrappedVariable(t.name)) new Job(async function () { await this.resolveUnit(t.name, 'type') }, `type:${t}`)
                    }
                }],
                [/^\$\(.*\)$/, {
                    name: 'selector',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor } = envelope, { scope, selector } = descriptor
                        if (value != undefined) for (const t of ([].concat(await this.resolveSelector(selector, scope)))) this.render(t, value)
                        return value
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { signal } = descriptor, { scope: scopeStatement, selector: selectorStatement } = descriptor,
                            scope = await this.resolveScope(scopeStatement, container), { sys } = this, { defaultEventTypes } = sys
                        if (!scope) return {}
                        const bangIndex = selectorStatement.lastIndexOf('!')
                        let selector = selectorStatement.trim(), eventList
                        if ((bangIndex > selector.lastIndexOf(']')) && (bangIndex > selector.lastIndexOf(')')) && (bangIndex > selector.lastIndexOf('"')) && (bangIndex > selector.lastIndexOf("'")))
                            [selector, eventList] = [selector.slice(0, bangIndex).trim(), selector.slice(bangIndex + 1).trim()]
                        if (eventList) eventList = eventList.split(sys.regexp.commaSplitter).filter(Boolean)
                        else if (container.dataset.facetCid) {
                            const [statementIndex, stepIndex] = position.split('-')
                            if (!this.app.facets[container.dataset.facetCid]?.statements?.[+statementIndex]?.steps[+stepIndex + 1]) return { selector, scope }
                        }
                        for (let eventName of eventList ?? Array.from(new Set(Object.values(defaultEventTypes).concat(['click'])))) {
                            const enSlice3 = eventName.slice(-3), keepDefault = enSlice3.includes('+'), exactMatch = enSlice3.includes('='), once = enSlice3.includes('-')
                            for (const [v, r] of [[keepDefault, '+'], [exactMatch, '='], [once, '-']]) if (v) eventName = eventName.replace(r, '')
                            scope.addEventListener(eventName, event => {
                                this.runFragment('env/interpreters/selector', event, selector, scope, exactMatch, defaultEventTypes, keepDefault, container, position)
                            }, { signal, once })
                        }
                        return { selector, scope }
                    }
                }],
                [/^[#@](?:[a-zA-Z0-9]+|[{][a-zA-Z0-9#@?!, ]*[}]|[\[][a-zA-Z0-9#@?!, ]*[\]])$/, {
                    name: 'state',
                    handler: async function (container, position, envelope, value) {
                        const { descriptor } = envelope, { getReturnValue, shape, target } = descriptor
                        if (value == undefined) return getReturnValue()
                        switch (shape) {
                            case 'single': target[target.type].set(value, target.mode); break
                            case 'array': if (Array.isArray(value)) for (let i = 0, v, t, l = value.length; i < l; i++) if ((v = value[i]) !== undefined) (t = target[i])[t.type].set(v, t.mode); break
                            case 'object': if (value instanceof Object) for (const k in value) if (value[k] !== undefined) if (k in target) target[k][target[k].type].set(value[k], target[k].mode)
                        }
                    },
                    binder: async function (container, position, envelope) {
                        const { descriptor } = envelope, { signal, shape } = descriptor, items = []
                        let { target } = descriptor, getReturnValue
                        switch (shape) {
                            case 'single':
                                const { type, name } = target
                                target[type] = type === 'field' ? (new this.Field(container, name)) : (new this.Cell(name))
                                getReturnValue = () => target[type].get()
                                items.push(target)
                                break
                            case 'array':
                                for (const t of target) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(container, t.name)) : (new this.Cell(t.name))
                                getReturnValue = (r = [], l) => {
                                    for (const t of target) if ((r[l ??= r.length] = t[t.type].get()) === undefined) return
                                    return r
                                }
                                break
                            case 'object':
                                if (Array.isArray(target)) target = Object.fromEntries(target)
                                for (const t of Object.values(target)) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(container, t.name)) : (new this.Cell(t.name))
                                getReturnValue = (r = {}, tk) => {
                                    for (const k in target) if ((r[k] = (tk = target[k])[tk.type].get()) === undefined) return
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
                        const { descriptor, variables } = envelope, { api: a, action: actionSignature } = descriptor, wrapped = variables && true,
                            valueEnvelope = Object.freeze({ ...envelope, value }), api = await this.resolveUnit(variables?.api ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'api')
                        if (!api) return
                        const vAction = variables?.action, action = vAction ? this.resolveVariable(actionSignature, valueEnvelope, { wrapped }) : actionSignature
                        if (vAction && !action) return
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
                        const { descriptor, variables } = envelope, { ai: m, prompt: p } = descriptor, wrapped = variables && true, valueEnvelope = Object.freeze({ ...envelope, value }),
                            ai = await this.resolveUnit(variables?.ai ? this.resolveVariable(m, valueEnvelope, { wrapped }) : a, 'ai')
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
                    handler: async function (container, position, envelope, value) { return await this.runFragment('env/interpreters/request', envelope, value) },
                    binder: async function (container, position, envelope) {
                        const { descriptor, variables } = envelope, { contentType } = descriptor
                        if (!variables?.contentType) new Job(async function () { await this.resolveUnit(contentType, 'transform') }, `transform:${contentType}`)
                    }
                }],
                [/^_.*_$/, {
                    name: 'wait',
                    handler: async function (container, position, envelope, value) { return await this.runFragment('env/interpreters/wait', container, position, envelope, value) }
                }],
                [/^\$\`[^`]+\`$/, {
                    name: 'command',
                    handler: async function (container, position, envelope, value) { return this.modules.dev ? (await this.runFragment('env/interpreters/command', envelope, value)) : value }
                }],
                [/^\$\??$/, {
                    name: 'console',
                    handler: async function (container, position, envelope, value) {
                        return this.modules.dev
                            ? ((envelope.descriptor.verbose === true ? (console.log(await this.flatten({ container, position, envelope, value }))) : (console.log(value))) ?? value) : value
                    }
                }]
            ]),
            languages: {},
            libraries: {
                jsonata: 'https://cdn.jsdelivr.net/npm/jsonata@2.0.5/+esm', md: 'https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm#Remarkable',
                schema: 'https://cdn.jsdelivr.net/gh/nuxodin/jema.js@1.2.0/schema.min.js#Schema', xdr: 'https://cdn.jsdelivr.net/gh/cloudouble/simple-xdr/xdr.min.js'
            },
            models: {},
            namespaces: { e: new URL(`./components`, import.meta.url) },
            patterns: {}, renderers: {}, resolvers: {}, snippets: {},
            transforms: {
                'application/json': (E) => (new E.Transform((input) => { try { return JSON.stringify(input) } catch (e) { } })), 'text/markdown': import.meta.resolve('./transforms/md.js'),
                'application/x-xdr': `${import.meta.resolve('./transforms/xdr.js')}#application`, 'text/x-xdr': `${import.meta.resolve('./transforms/xdr.js')}#text`,
            },
            types: {}
        }
    },

    Compile: { enumerable: true, value: function () { return this.runFragment('compile') } }, // optimal
    Dev: { enumerable: true, value: function () { return this.runFragment('dev') } }, // optimal
    Expose: { enumerable: true, value: function (name) { window[name || 'E'] ??= this } }, // optimal
    ImportPackage: { // optimal
        enumerable: true, value: async function (pkg, packageUrl, packageKey) {
            if (!this.isPlainObject(pkg)) return
            if (typeof pkg.hooks?.prePackageInstall === 'function') pkg = (await pkg.hooks.prePackageInstall(this)) ?? pkg
            const promises = [], postPackageInstall = pkg.hooks?.postPackageInstall, { env } = this
            if (postPackageInstall) delete pkg.hooks.postPackageInstall
            for (const unitTypeCollectionName in pkg) if (unitTypeCollectionName in env) {
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
            const { env, app, sys, runUnit } = this, { interpreters } = env, { _eventTarget } = app
            for (const [, interpreter] of interpreters) for (const p of ['handler', 'binder']) if (interpreter[p]) interpreter[p] = interpreter[p].bind(this)
            const interpretersProxyError = () => { throw new Error('Interpreters are read-only at runtime.') }
            env.interpreters = Object.freeze(new Proxy(interpreters, {
                set: interpretersProxyError, delete: interpretersProxyError, clear: interpretersProxyError,
                get: (target, prop) => (typeof target[prop] === 'function') ? target[prop].bind(target) : Reflect.get(target, prop)
            }))
            Object.freeze(env)
            Object.freeze(app)
            for (const eventName of ['beforeinstallprompt', 'beforeunload', 'appinstalled', 'offline', 'online', 'visibilitychange', 'pagehide', 'pageshow']) window.addEventListener(eventName, event => {
                _eventTarget.dispatchEvent(new CustomEvent(eventName, { detail: this }))
                runUnit.call(this, eventName, 'hook')
            })
            this.mountElement(document.documentElement).then(async () => {
                _eventTarget.dispatchEvent(new CustomEvent('load', { detail: this }))
                await runUnit.call(this, 'load', 'hook')
                new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100)).then(() => this.processQueue())
            })
        }
    },

    createEnvelope: { // optimal
        enumerable: true, value: async function (value = {}) {
            return Object.freeze({ ...(this.isPlainObject(value) ? value : { value }), cells: await this.flatten(this.app.cells), context: this.env.context })
        }
    },
    deepFreeze: { //optimal
        enumerable: true, value: function (obj, copy, isArray) {
            if (!(isArray ??= Array.isArray(obj)) && !this.isPlainObject(obj)) return obj
            try { if (copy) obj = JSON.parse(JSON.stringify(obj)) } catch (e) { }
            for (const v of (isArray ? obj : Object.values(obj))) this.deepFreeze(v)
            return Object.freeze(obj)
        }
    },
    flatten: { //optimal
        enumerable: true, value: async function (value, event) {
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
            if (value instanceof this.Component) return value.valueOf()
            if (value instanceof HTMLElement) {
                const { processElementMapper } = await this.runFragment('sys/mappers')
                return new Proxy({}, { get: (target, prop) => processElementMapper.call(this, value, prop, mappers), has: (target, prop) => processElementMapper.call(value, prop, mappers, true) })
            }
            for (const p in this) if ((p.charCodeAt(0) <= 90) && (this[p].prototype instanceof this[p]) && value instanceof this[p]) return value.valueOf()
        }
    },
    generateUuid: {//optimal
        enumerable: true, value: function (noDashes) {
            return crypto?.randomUUID()?.[noDashes ? 'replace' : 'toString'](this.sys.regexp.dash, '')
                ?? (noDashes ? 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx' : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(this.sys.regexp.xy, c => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4 + 8)) | 0).toString(16))
        }
    },
    getCustomTag: { // optimal
        enumerable: true, value: function (element) {
            let tag = (element instanceof HTMLElement) ? (element.getAttribute('is') || element.tagName).toLowerCase() : `${element}`.toLowerCase()
            return tag.includes('-') ? tag : undefined
        }
    },
    isFacetContainer: { enumerable: true, value: function (element) { return ((element instanceof HTMLScriptElement) && element.type?.endsWith('/element')) } }, // optimal
    isPlainObject: { // optimal
        enumerable: true, value: function (obj) {
            if (!obj) return false
            const proto = Object.getPrototypeOf(obj)
            return (proto === null) || (proto === Object.prototype) || (proto.constructor === Object)
        }
    },
    isWrappedVariable: { enumerable: true, value: function (expression) { return ((expression[0] === '$') && (expression[1] === '{') && (expression.endsWith('}'))) } }, // optimal
    parse: { enumerable: true, value: async function (input, contentType) { return this.runFragment('parse', input, contentType) } }, // optimal
    render: { enumerable: true, value: async function (element, data) { return this.runFragment('render', element, data) } }, // optimal
    resolveImport: { //optimal
        enumerable: true, value: async function (importHref, returnWholeModule, isWasm) {
            const { hash = '#default', origin, pathname } = (importHref instanceof URL) ? importHref : this.resolveUrl(importHref, undefined, true), url = `${origin}${pathname}`,
                module = (isWasm ?? pathname.endsWith('.wasm')) ? (await WebAssembly.instantiateStreaming(fetch(url))).instance.exports : await import(url)
            return returnWholeModule ? module : module[hash.slice(1)]
        }
    },
    resolveScope: { // optimal
        enumerable: true, value: async function (scopeStatement, element) {
            element = this.app._components.nativesFromVirtuals.get(element) ?? element
            if (!scopeStatement) return element.parentElement
            switch (scopeStatement) {
                case 'body': case 'head': return document[scopeStatement]
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
        enumerable: true, value: async function (scopedSelector, element) {
            const { impliedScopes, regexp } = this.sys, { pipeSplitter } = regexp
            element &&= this.app._components.nativesFromVirtuals.get(element) ?? element
            if (impliedScopes[scopedSelector]) return element ? (await this.resolveScope(impliedScopes[scopedSelector], element)) : { scope: impliedScopes[scopedSelector] }
            if (impliedScopes[scopedSelector[0]]) scopedSelector = `${impliedScopes[scopedSelector[0]]}|${scopedSelector}`
            let scope = element
            if (pipeSplitter.test(scopedSelector)) {
                const [scopeStatement, selectorStatement] = scopedSelector.split(pipeSplitter, 2).map(s => s.trim())
                if (!element) return { scope: scopeStatement, selector: selectorStatement }
                scope = await this.resolveScope(scopeStatement, element)
                scopedSelector = selectorStatement
            }
            return element ? (await this.resolveSelector(scopedSelector, scope)) : { selector: scopedSelector }
        }
    },
    resolveSelector: {  // optimal
        enumerable: true, value: async function (selector, scope) {
            if (!selector) return scope
            if (selector[0] === ':') return scope.querySelector(this.buildCatchallSelector(selector))
            let sliceSignature
            const lastIndexOfOpenCurlyBracket = selector.lastIndexOf('{'), isMulti = (lastIndexOfOpenCurlyBracket > 0) && selector.endsWith('}')
            if (isMulti) [selector, sliceSignature] = [selector.slice(0, lastIndexOfOpenCurlyBracket), selector.slice(lastIndexOfOpenCurlyBracket + 1, -1)]
            try {
                return isMulti ? this.sliceAndStep(sliceSignature, Array.from(scope.querySelectorAll(selector))) : scope.querySelector(selector)
            } catch (e) { return this.runFragment('resolveselector', selector, scope, isMulti, sliceSignature) }
        }
    },
    resolveUnit: { // optimal
        enumerable: true, value: async function (unitKey, unitType) {
            if (!unitKey || !unitType) return
            const unitKeyTest = Array.isArray(unitKey) ? 'array' : (this.isPlainObject(unitKey) ? 'object' : undefined)
            if (unitKeyTest) {
                const isArray = unitKeyTest === 'array', result = isArray ? [] : {}, keys = isArray ? unitKey : Object.keys(unitKey)
                for (const k of keys) result[isArray ? result.length : k] = await this.resolveUnit(k, unitKey[k])
                return result
            }
            if (unitType === 'resolver') return this.defaultResolver.bind(this)
            const { sys, app } = this, [unitTypeCollectionName, unitClassName] = sys.unitTypeMap[unitType], unitClass = typeof unitClassName === 'string' ? this[unitClassName] : unitClassName
            if (typeof unitKey !== 'string') return (unitKey instanceof unitClass) ? unitKey : undefined
            if (!(unitKey = unitKey.trim())) return
            let unit = app[unitTypeCollectionName][unitKey]
            if (unit) return unit
            const { queue } = sys, unitQueueJob = queue.get(`${unitType}:${unitKey}`) ?? queue.get(`${unitTypeCollectionName}:${unitKey}`)
            if (unitQueueJob) {
                await unitQueueJob.completed()
                if (unit = app[unitTypeCollectionName][unitKey]) return unit
            }
            const envUnit = this.env[unitTypeCollectionName][unitKey]
            let unitResolver
            if (envUnit) {
                if ((typeof envUnit === 'function') && !(envUnit instanceof unitClass)) await envUnit(this)
                else if (envUnit instanceof Promise) envUnit = await envUnit
                else if (typeof envUnit === 'string') unitResolver = await this.resolveUnit(unitType, 'resolver') ?? this.defaultResolver
                return app[unitTypeCollectionName][unitKey] = unitResolver ? await unitResolver.call(this, envUnit, unitType) : envUnit
            }
            if (this.sys.localOnlyUnitTypes.has(unitType)) return
            unitResolver ??= await this.resolveUnit(unitType, 'resolver') ?? this.defaultResolver
            return app[unitTypeCollectionName][unitKey] = await unitResolver.call(this, unitKey, unitType)
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
                const { regexp } = this.sys, path = valueUrl.pathname.replace(regexp.leadingSlash, '')
                switch (typeof gateway) {
                    case 'function':
                        const gatewayArgs = { path }
                        for (const k in valueUrl) if (typeof valueUrl[k] === 'string') gatewayArgs[k] = valueUrl[k]
                        return raw ? new URL((gateway(gatewayArgs)), base) : (gateway(gatewayArgs))
                    case 'string':
                        const mergedUrl = new URL(gateway.replace(regexp.gatewayUrlTemplateMergeField, (match, mergeExpression) => {
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
    resolveVariable: { // optimal
        enumerable: true, value: function (expression, envelope = {}, flags = {}) {
            expression = expression.trim()
            const { sys, resolveVariable } = this, { regexp, valueAliases } = sys
            let result, { wrapped = false, default: dft = (!wrapped ? expression : undefined), spread, merge } = flags
            if (merge) {
                result = expression.replace(regexp.hasVariable, (match, varExpression) => (resolveVariable.call(this, varExpression, envelope) ?? match))
            } else if (typeof expression === 'string') {
                if (wrapped || (wrapped === null)) {
                    const expressionIsWrapped = this.isWrappedVariable(expression)
                    if (wrapped && !expressionIsWrapped) return expression
                    wrapped ??= expressionIsWrapped
                }
                expression = expression.trim()
                if (wrapped) expression = expression.slice(2, -1).trim()
                const { context, cells, fields, labels, value } = envelope, e0 = expression[0]
                if (expression in valueAliases) result = valueAliases[expression]
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
                    if (context || cells || fields || labels || ('value' in envelope)) result = resolveVariable.call(this, expression, envelope, { ...flags, wrapped: false })
                }
                else if (((e0 === '"') && expression.endsWith('"')) || ((e0 === "'") && expression.endsWith("'"))) result = expression.slice(1, -1)
                else if (regexp.isNumeric.test(expression)) result = expression % 1 === 0 ? parseInt(expression, 10) : parseFloat(expression)
                else result = expression
            } else if (Array.isArray(expression)) {
                result = []
                for (let i = 0, l = expression.length, a = spread && Array.isArray(dft); i < l; i++) result.push(resolveVariable.call(this, expression[i], envelope, { default: a ? dft[i] : dft }))
            } else if (this.isPlainObject(expression)) {
                result = {}
                const dftIsObject = spread && this.isPlainObject(dft)
                for (const key in expression) result[resolveVariable.call(this, key, envelope)] = resolveVariable.call(this, expression[key], envelope, { default: dftIsObject ? dft[key] : dft })
            }
            return result === undefined ? dft : result
        }
    },
    runUnit: { // optimal
        enumerable: true, value: async function (unitKey, unitType, ...args) {
            const unit = await this.resolveUnit(unitKey, unitType), isArray = Array.isArray(unit), isObject = !isArray && this.isPlainObject(unit),
                promises = (isArray || isObject) && [], result = isObject && {}
            if (!unit) return
            if (isArray) {
                for (const u of unit) promises.push(typeof u === 'function' ? u(...args) : (u?.run(...args) ?? u))
                return Promise.all(promises)
            } else if (isObject) {
                for (const k in unit) promises.push(Promise.resolve(typeof unit[k] === 'function' ? unit[k](...args) : (unit[k]?.run(...args) ?? unit[k])).then(resolved => result[k] = resolved))
                return Promise.all(promises).then(() => result)
            }
            return unit?.run(...args)
        }
    },
    serialize: { enumerable: true, value: async function (input, contentType = 'application/json') { return this.runFragment('serialize', input, contentType) } }, // optimal
    toCamelCase: { // optimal
        enumerable: true, value: function (str) {
            const { dashUnderscoreSpace, nothing } = this.sys.regexp
            return str.replace(dashUnderscoreSpace, (_, c) => (c ? c.toUpperCase() : '')).replace(nothing, (c) => c.toLowerCase())
        }
    },
    toKebabCase: { enumerable: true, value: function (str) { return str.replace(this.sys.regexp.lowerCaseThenUpper, '$1-$2').replace(this.sys.regexp.upperCaseThenAlpha, '$1-$2').toLowerCase() } }, // optimal

    app: { // optimal
        value: Object.defineProperties({}, {
            cells: { enumerable: true, value: {} }, _components: { value: { nativesFromVirtuals: new WeakMap(), bindings: new WeakMap(), virtualsFromNatives: new WeakMap() } },
            _eventTarget: { value: new EventTarget() }, _facetInstances: { value: new WeakMap() }, _fragments: { value: {} }, _observers: { value: new WeakMap() }
        })
    },
    modules: { enumerable: true, value: {} }, // optimal
    sys: { // optimal
        value: Object.freeze({
            defaultEventTypes: Object.freeze({
                audio: 'loadeddata', body: 'load', details: 'toggle', dialog: 'close', embed: 'load', form: 'submit', iframe: 'load', img: 'load', input: 'change', link: 'load',
                meta: 'change', object: 'load', script: 'load', search: 'change', select: 'change', slot: 'slotchange', style: 'load', textarea: 'change', track: 'load', video: 'loadeddata'
            }),
            impliedScopes: Object.freeze({ ':': '*', '#': 'html' }),
            localOnlyUnitTypes: new Set(['hook']),
            locationKeyMap: { '#': 'hash', '/': 'pathname', '?': 'search' },
            queue: new Map(),
            regexp: Object.freeze({
                commaSplitter: /\s*,\s*/, colonSplitter: /\s*\:\s*/, dashUnderscoreSpace: /[-_\s]+(.)?/g, extractAttributes: /(?<=\[)([^\]=]+)/g, gatewayUrlTemplateMergeField: /{([^}]+)}/g,
                lowerCaseThenUpper: /([a-z0-9])([A-Z])/g, upperCaseThenAlpha: /([A-Z])([A-Z][a-z])/g, hasVariable: /\$\{(.*?)\}/g, isFormString: /^\w+=.+&.*$/,
                isHTML: /<[^>]+>|&[a-zA-Z0-9]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/, isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, leadingSlash: /^\/+/, nothing: /^(.)/, notAlphaNumeric: /[^a-zA-Z0-9]/,
                pipeSplitter: /(?<!\|)\|(?!\|)(?![^\[]*\])/, pipeSplitterAndTrim: /\s*\|\s*/, dash: /-/g, xy: /[xy]/g, selectorBranchSplitter: /\s*,\s*(?![^"']*["'][^"']*$)/,
                selectorSegmentSplitter: /(?<=[^\s>+~|\[])\s+(?![^"']*["'][^"']*$)|\s*(?=\|\||[>+~](?![^\[]*\]))\s*/, spaceSplitter: /\s+/
            }),
            resolveShape: Object.freeze({ startFlags: new Set(['[', '?', '{']), endFlags: Object.freeze({ '.': true, '!': false, '-': null, '?': undefined }), closers: Object.freeze({ '{': '}', '[': ']' }) }),
            unitTypeCollectionNameToUnitTypeMap: Object.freeze({
                apis: 'api', components: 'component', content: 'content', context: 'context', facets: 'facet', gateways: 'gateway', hooks: 'hook',
                interpreters: 'interpreter', languages: 'language', libraries: 'library', ais: 'ai', namespaces: 'namespace', patterns: 'pattern', resolvers: 'resolver',
                snippets: 'snippet', transforms: 'transform', types: 'type'
            }),
            unitTypeMap: Object.freeze({
                api: ['apis', 'API'], component: ['components', 'Component'], content: ['content', 'Collection'], context: ['context', Object], facet: ['facets', 'Facet'], gateway: ['gateways', 'Gateway'],
                hook: ['hooks', Function], interpreter: ['interpreters', Object], language: ['languages', 'Language'], library: ['libraries', Object], ai: ['ais', 'AI'],
                namespace: ['namespaces', URL], pattern: ['patterns', RegExp], resolver: ['resolvers', Function], snippet: ['snippets', HTMLElement], transform: ['transforms', 'Transform'],
                type: ['types', 'Type']
            }),
            valueAliases: Object.freeze({ 'null': null, 'undefined': undefined, 'false': false, 'true': true, '-': null, '?': undefined, '!': false, '.': true })
        })
    },

    activateTag: { // optimal
        value: async function (tag) {
            if (!tag || globalThis.customElements.get(tag) || !this.getCustomTag(tag)) return
            let componentClass = await this.resolveUnit(tag, 'component')
            if (!componentClass) {
                const [namespace, ...name] = tag.split('-'), namespaceBase = this.resolveUrl(this.app.namespaces[namespace] ?? `./components/${namespace}`), componentUrl = `${namespaceBase}/${name.join('/')}.html`
                componentClass = this.app.components[tag] = await this.modules.compile?.component(componentUrl)
            }
            if (!componentClass) return
            const { subspaces, style, template } = componentClass
            for (const subspaceName of (subspaces)) {
                let virtualSubspaceName = `${subspaceName}x${crypto.randomUUID().split('-').join('')}`
                this.app.namespaces[virtualSubspaceName] = subspaces[subspaceName]
                componentClass.template.innerHTML = template.innerHTML.replace(new RegExp(`<${subspaceName}-`, 'g'), `<${virtualSubspaceName}-`)
                    .replace(new RegExp(`</${subspaceName}-`, 'g'), `</${virtualSubspaceName}-`).replace(new RegExp(` is='${subspaceName}-`, 'g'), ` is='${virtualSubspaceName}-`)
                    .replace(new RegExp(` is="${subspaceName}-`, 'g'), ` is="${virtualSubspaceName}-`).replace(new RegExp(` is=${subspaceName}-`, 'g'), ` is=${virtualSubspaceName}-`)
                componentClass.style.textContext = style.textContext.replace(new RegExp(`${subspaceName}-`, 'g'), `${virtualSubspaceName}-`)
            }
            globalThis.customElements.define(tag, componentClass)
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
    defaultResolver: { value: async function (unitKey, unitType) { return this.runFragment('defaultresolver', unitKey, unitType) } }, // optimal
    installGateway: { // optimal - but needs testing to see how it can integrate with runUnit() and both the Gateway class and the Renderer class
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
                    case 'string': if ((await fetch(`${window.location.protocol}//${head}`, { method: 'HEAD' })).ok) connection = true; break
                    case 'function': connection = await head.bind(this, { as: 'head', ctx, protocol })(); break
                }
                if (!connection) continue
                let useGateway = typeof gateway === 'function' ? gateway.bind(this, { as: 'gateway', connection, ctx, protocol }) : gateway
                if (auto) {
                    const urlAttributes = ['href', 'src']
                    this.app._observers.set(useGateway, new MutationObserver(records => {
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
                    this.app._observers.get(useGateway).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: urlAttributes })
                }
                return this.app.gateways[protocol] = useGateway
            }
        }
    },
    installModule: { // optimal
        value: async function (moduleName) {
            const { module } = await import(import.meta.resolve(`./modules/${moduleName}.js`))
            for (const p in module) if (typeof module[p].value === 'function') (module[p].value = module[p].value.bind(this))
            return Object.defineProperty(this.modules, moduleName, { enumerable: true, value: Object.freeze(Object.defineProperties({}, module)) })[moduleName]
        }
    },
    mountElement: { // optimal
        value: async function (element) {
            if (this.isFacetContainer(element)) return this.mountFacet(element)
            const customTag = this.getCustomTag(element)
            if (customTag) {
                await this.activateTag(customTag)
                const isAttr = element.getAttribute('is')
                if (isAttr) {
                    const componentInstance = this.app._components.virtualsFromNatives.set(element, document.createElement(isAttr)).get(element)
                    for (const a of element.attributes) componentInstance.setAttribute(a.name, a.value)
                    if (element.innerHTML != undefined) componentInstance.innerHTML = element.innerHTML
                    this.app._components.nativesFromVirtuals.set(componentInstance, element)
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
                        this.app._components.bindings.set(element, observer)
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
                    this.app._observers.set(root, observer)
                }
            }
            const promises = []
            if (element.shadowRoot?.children) for (const n of element.shadowRoot.children) promises.push(this.mountElement(n))
            for (const n of element.children) promises.push(this.mountElement(n))
            return Promise.all(promises)
        }
    },
    mountFacet: { // needs revision to check for overlaps with Facet
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
                    FacetClass = await this.resolveUnit(src, 'facet')
                    facetCid = FacetClass.cid
                    break
            }
            FacetClass ??= this.app.facets[facetCid]
            if (!(FacetClass?.prototype instanceof this.Facet)) return
            if (this.modules.dev) facetContainer.dataset.facetCid = facetCid
            const facetInstance = new FacetClass()
            this.app._facetInstances.set(facetContainer, facetInstance)
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
            for (const job of this.sys.queue.values()) job.run()
            await new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100))
            this.processQueue()
        }
    },
    runFragment: { // optimal
        value: async function (fragmentKey, ...args) {
            const fragment = (this.app._fragments[fragmentKey] ??= (await import(import.meta.resolve(`./fragments/${fragmentKey}.js`)))?.default)
            return typeof fragment === 'function' ? fragment.call(this, ...args) : fragment
        }
    },
    resolveShapeHandleImplicitValue: { // optimal
        value: function (key) {
            const { endFlags } = this.sys.resolveShape, endFlag = key.slice(key.length - 1)
            return (endFlag in endFlags) ? endFlags[endFlag] : [key, key]
        }
    },
    resolveShapeSplitIgnoringNesting: { // optimal
        value: function (input, delimiter, nesters, byFirst) {
            const result = byFirst ? undefined : [], { closers } = this.sys.resolveShape
            let current = '', depth = 0, inQuote = null
            for (let i = 0, l = input.length; i < l; i++) {
                const char = input[i]
                if (inQuote) {
                    current += char
                    if (char === inQuote) inQuote = null
                } else {
                    if (char === '"' || char === "'") {
                        inQuote = char
                        current += char
                    } else if (nesters.includes(char)) {
                        depth += 1
                        current += char
                    } else if (nesters.includes(closers[char])) {
                        depth -= 1
                        current += char
                    } else if (char === delimiter && depth === 0) {
                        if (byFirst) return [current.trim(), input.slice(i + 1).trim()]
                        result.push(current.trim())
                        current = ''
                    } else current += char
                }
            }
            if (!byFirst && current) result.push(current.trim())
            return byFirst ? [current.trim()] : result
        }
    },
    resolveShapeParseCompound: { // optimal
        value: function (input, flag) {
            const isQs = flag === '?', isArray = flag === '[', delimiter = isQs ? '&' : ',', subDelimiter = isQs ? '=' : ':', nesters = ['"', "'", ...(isQs ? [] : ['[', ']', '{', '}'])],
                result = isArray ? [] : {}, entries = this.resolveShapeSplitIgnoringNesting(input.slice(1, -1), delimiter, nesters)
            for (const entry of entries) {
                if (isArray) { result.push(this.resolveShape(entry.trim())); continue }
                const [rawKey, rawValue] = this.resolveShapeSplitIgnoringNesting(entry, subDelimiter, nesters, true)
                let key = rawKey.trim(), value = rawValue !== undefined ? rawValue.trim() : undefined
                if (value === undefined) [key, value] = this.resolveShapeHandleImplicitValue(key)
                else if (flag === '{') value = this.resolveShape(value)
                result[key] = value
            }
            return result
        }
    },
    resolveShape: { // optimal
        value: function (input) {
            if (typeof input !== 'string') return input
            if (this.sys.resolveShape.startFlags.has(input[0])) return this.resolveShapeParseCompound(input, input[0])
            return input
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
    unmountElement: { // optimal - but check for interplace with this.app._components ... virtuals, natives and bindings
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
            const facetInstance = this.app._facetInstances.get(facetContainer)
            for (const p in facetInstance.controllers) facetInstance.controllers[p].abort()
            facetInstance.controller.abort()
            facetInstance.observer.disconnect()
        }
    },

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
                            this.modelWrapper = async input => (await (this.model ??= await E.resolveUnit(model, 'model')).run(input))
                            new E.Job(async function () { await E.resolveUnit(model, 'model') }, `model:${model}`)
                            break
                        case 'object':
                            if (model instanceof E.Model) this.modelWrapper = async input => (await (this.model ??= model).run(input))
                            else if (E.isPlainObject(model)) this.modelWrapper = async input => (await (this.model ??= new E.Model(model)).run(input))
                    }
                }
                if (api) {
                    switch (typeof api) {
                        case 'function': this.apiWrapper = api.bind(this); break
                        case 'string':
                            this.apiWrapper = async input => (await (this.api ??= await E.resolveUnit(api, 'api')).run(input))
                            new E.Job(async function () { await E.resolveUnit(api, 'api') }, `api:${api}`)
                            break
                        case 'object':
                            if (api instanceof E.API) this.apiWrapper = async input => (await (this.api ??= api).run(input))
                            else if (E.isPlainObject(api)) this.apiWrapper = async input => (await (this.api ??= new E.API(api)).run(input))
                    }
                }
                this.engine = async input => ((this.model?.loaded ? this.modelWrapper : (this.apiWrapper ?? this.modelWrapper))(input))
            }
            async run(input, promptTemplateKey, envelope) {
                if (!this.engine) return
                if (typeof input === 'string') {
                    const promptTemplate = promptTemplateKey ? (this.promptTemplates[promptTemplateKey] ?? '$') : '$'
                    input = this.constructor.E.resolveVariable(promptTemplate, { ...envelope, value: input }, { merge: true })
                }
                return this.engine(input)
            }
        }
    },
    API: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ base = '.', actions = {}, options = {}, contentType = 'application/json', acceptType, preProcessor, postProcessor, errorProcessor }) {
                Object.assign(this, { E: this.constructor.E, base: this.resolveUrl(base), actions, options, contentType, acceptType, preProcessor, postProcessor, errorProcessor })
                this.acceptType ??= this.contentType
                new Job(async function () { await this.resolveUnit(this.contentType, 'transformer') }, `transformer:${this.contentType}`)
                if (this.acceptType && (this.acceptType !== this.contentType)) new Job(async function () { await this.resolveUnit(this.acceptType, 'transformer') }, `transformer:${this.acceptType}`)
                for (const p of ['preProcessor', 'postProcessor', 'errorProcessor']) if (this[p]) new Job(async function () { await this.resolveUnit(this[p], 'transformer') }, `transformer:${this[p]}`)
                if (this.actions) Object.freeze(this.actions)
                if (this.options) Object.freeze(this.options)
            }
            async run(value, action, envelope) {
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
                if (typeof slug === 'string') {
                    slug = this.constructor.E.resolveVariable(slug, envelope, { merge: true })
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
                const { style, template, shadow } = this.constructor
                try {
                    if (style || template) {
                        const shadowRoot = this.attachShadow(shadow)
                        if (style) shadowRoot.append(style.cloneNode(true))
                        if (template) shadowRoot.append(...template.content.cloneNode(true).children)
                    }
                } catch (e) { }
            }
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            valueOf() { return this.E.flatten(this) } // this has to change to be a syncronous manual flattening at this point
            toJSON() { return this.valueOf() }
            dispatchEvent(event) {
                const eventProps = { detail: event.detail, bubbles: event.bubbles, cancelable: event.cancelable, composed: event.composed }, { E } = this.constructor, defaultEventTypes = E.sys
                let virtualElement = E.app._components.virtualsFromNatives.get(this), nativeElement = E.app._components.nativesFromVirtuals.get(this),
                    eventName = event.type === 'default' ? undefined : event.type
                if (virtualElement || nativeElement) {
                    virtualElement ??= this
                    nativeElement ??= this
                    eventName ??= virtualElement.constructor.events?.default ?? defaultEventTypes[nativeElement.tagName.toLowerCase()] ?? 'click'
                    return virtualElement.dispatchEvent(new CustomEvent(eventName, eventProps)) && nativeElement.dispatchEvent(new CustomEvent(eventName, eventProps))
                }
                eventName ??= instance instanceof E.Component ? (instance.constructor.events?.default) : defaultEventTypes[instance.tagName.toLowerCase()]
                return super.dispatchEvent(new CustomEvent(eventName ?? 'click', eventProps))
            }
        }
    },
    Facet: { // optimal - but needs to recheck
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
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, defaultExpression, signature } = step, { interpreter: interpreterKey, variables } = signature,
                            descriptor = { ...(signature.descriptor ?? {}) }, { signal } = descriptor, envelope = { descriptor, labels, fields, cells, context, variables }
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
                            const handlerEnvelope = { ...envelope, fields: Object.freeze(await E.flatten(fields)), cells: Object.freeze(await E.flatten(cells)), labels: Object.freeze({ ...labels }) },
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
    Job: { // optimal
        enumerable: true, value: class {
            static E
            running = false
            static cancelJob(id) { return this.constructor.E.sys.queue.delete(id) }
            static isComplete(id) { return !this.constructor.E.sys.queue.get(id) }
            static isRunning(id) { return this.constructor.E.sys.queue.get(id)?.running }
            static getJobFunction(id) { return this.constructor.E.sys.queue.get(id)?.jobFunction }
            static getJobRunner(id) { return this.constructor.E.sys.queue.get(id)?.runner }
            static waitComplete(id, deadline = 1000) {
                const { queue } = this.E.sys
                if (!queue.has(id)) return
                const timeoutFunc = window.requestIdleCallback ?? window.setTimeout, timeoutArg = window.requestIdleCallback ? undefined : 1, now = Date.now()
                deadline = now + deadline
                let beforeDeadline = (now < deadline)
                return new Promise((async res => {
                    while (beforeDeadline && queue.has(id)) {
                        await new Promise(resolve => timeoutFunc(resolve, timeoutArg))
                        beforeDeadline = (Date.now() < deadline)
                    }
                    res(!queue.has(id))
                }))
            }
            constructor(jobFunction, id) {
                const { E } = this.constructor, { queue } = E.sys
                if (typeof jobFunction !== 'function') return
                this.id = id ?? E.generateUuid()
                if (queue.get(this.id)) return
                this.jobFunction = jobFunction
                queue.set(this.id, this)
            }
            cancel() { this.constructor.E.sys.queue.delete(this.id) }
            complete() { return this.constructor.waitComplete(this.id) }
            async run() { if (!this.running) return this.runner() }
            async runner() {
                if (this.running) return
                this.running = true
                try { await this.jobFunction.call(this.constructor.E) } finally { this.cancel() }
            }
        }
    },
    Language: { // optimal
        enumerable: true, value: class {
            static E
            static validEngineClasses = new Set(['AI', 'API'])
            constructor({ defaultTokenValue = '', tokens = {}, virtual = {}, envelope }) {
                const { E } = this.constructor
                if (!E.isPlainObject(tokens)) return
                if (!E.isPlainObject(virtual)) virtual = undefined
                if (!E.isPlainObject(envelope)) envelope = undefined
                switch (typeof virtual.engine) {
                    case 'string': break
                    case 'object':
                        const validEngine = false
                        for (const n of validEngineClasses.keys()) if (validEngine ||= (engine instanceof E[n])) break
                        if (validEngine) break
                    default: delete virtual.engine
                }
                if (virtual && !virtual.engine) return
                if (!(Array.isArray(virtual.preload) || virtual.preload === true)) delete virtual.preload
                if (typeof virtual.base !== 'string') delete virtual.base
                if (!(typeof defaultTokenValue === 'string' || defaultTokenValue === true)) defaultTokenValue = ''
                Object.assign(this, { defaultTokenValue, tokens: Object.freeze(tokens), virtual })
                if (typeof virtual.engine === 'string') {
                    const [engineType, engineNamePlusIntent] = virtual.engine.trim().split(E.sys.regexp.colonSplitter), [engineName, engineIntent] = engineNamePlusIntent.split(E.sys.regexp.pipeSplitter),
                        loadEngineJob = new E.Job(async function () { await await E.resolveUnit(engineName, engineType) }, `${engineType}:${engineName}`)
                    virtual.engine = loadEngineJob.complete.then(async () => {
                        const engine = await E.resolveUnit(engineName, engineType), validEngine = false
                        for (const n of validEngineClasses.keys()) if (validEngine ||= (this.engine instanceof E[n])) break
                        if (!validEngine) return
                        virtual.engine = engine
                        if (engineIntent != null) virtual.engineIntent = engineIntent || true
                        virtual.lang ??= {}
                        Object.freeze(virtual)
                    })
                }
                if (virtual && Array.isArray(virtual.preload)) this.preload()
            }
            saveVirtual(virtualTokens, langCode) { this.virtual.lang[langCode] = Object.freeze(virtualTokens) }
            async preload(langCode) {
                const { virtual = {}, saveVirtual, tokens } = this
                if (virtual.engine instanceof Promise) await virtual.engine
                if (!virtual.engine) return
                const { engine, engineIntent, preload, lang, base } = virtual, engineInputBase = { base, tokens }, envelope = await this.constructor.E.createEnvelope(this.envelope ?? {}), promises = []
                if (langCode) return (lang[langCode] ??= engine.run({ ...engineInputBase, to: langCode }, engineIntent, envelope).then(virtualTokens => saveVirtual(virtualTokens, langCode)))
                if (Array.isArray(preload)) for (const preloadLangCode of preload)
                    promises.push(lang[preloadLangCode] ??= engine.run({ ...engineInputBase, to: preloadLangCode }, engineIntent, envelope).then(virtualTokens => saveVirtual(virtualTokens, virtualLangCode)))
                return Promise.all(promises)
            }
            async run(token, langCode, envelope) {
                const defaultResult = (this.defaultTokenValue === true ? token : this.defaultTokenValue)
                if (!(token in this.tokens)) return defaultResult
                if (!(this.virtual && langCode)) return this.tokens[token] ?? defaultResult
                const { virtual } = this, { engine, engineIntent, lang, base } = virtual
                if (!(langCode && engine)) return
                const [baseLangCode,] = langCode.split('-')
                lang[langCode] ??= {}
                let langTokens = lang[langCode]
                if (token in langTokens) return langTokens[token] ?? defaultResult
                lang[baseLangCode] ??= {}
                langTokens = lang[baseLangCode]
                if (token in langTokens) return langTokens[token] ?? defaultResult
                if (virtual.preload) {
                    await Promise.resolve(this.preload(langCode))
                    Object.freeze(langTokens)
                    return langTokens[token] ?? defaultResult
                }
                return langTokens[token] ??= await this.engine.run({ token, tokenValue: this.tokens[token], from: base, to: langCode }, engineIntent, envelope)
            }
        }
    },
    Model: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ inference, library, load, name, options = {} }) {
                const { E } = this.constructor
                if (!((library && (typeof library === 'string')) && (typeof load === 'function') && (typeof inference === 'function'))) return
                this.inference = inference.bind(this)
                this.name = name ?? E.generateUuid()
                new E.Job(async function () { await this.load(library, load, options) }, `model:${this.name}`)
            }
            async load(library, load, options) {
                const { E } = this.constructor
                if (this.loaded) return true
                this.library ??= await E.resolveUnit(library, 'library')
                if (!this.library) return
                this.options = options ?? {}
                this.loader ??= load.bind(this)
                if (!this.loader) return
                this.loaded = !!(this.engine ??= (await this.loader(this.library, (this.options.load ?? {}))))
                return this.loaded
            }
            async run(input) {
                const { E } = this.constructor
                if (!this.loaded) await E.Job.waitComplete(`model:${this.name}`, Infinity)
                return this.inference(input, this.engine, this.options.inference ?? {})
            }
        }
    },
    Renderer: { // optimal
        enumerable: true, value: class {
            static E
            static validEngineClasses = new Set(['AI', 'API', 'Collection', 'Language', 'Transform'])
            observers = new WeakMap()
            constructor({ engine, matches = {}, mode, scopeSelector, name, namespace, labels = {}, defaultValue = '', envelope }) {
                const { E, validEngineClasses } = this.constructor
                if (!engine) return
                switch (typeof engine) {
                    case 'string': this.engine = engine; break
                    case 'object':
                        const validEngine = false
                        for (const n of validEngineClasses.keys()) if (validEngine ||= (engine instanceof E[n])) break
                        if (!validEngine) return
                        break
                    default: return
                }
                if ((typeof mode !== 'string') || (!(name && (typeof name === 'string'))) || !E.isPlainObject(matches) || !E.isPlainObject(labels) || !E.isPlainObject(envelope)) return
                name = (name && typeof name === 'string') ? name.replaceAll(E.sys.regexp.notAlphaNumeric, '').toLowerCase() : E.generateUuid(true)
                mode = mode ? mode.trim().toLowerCase() : name
                if (!mode && !Object.keys(this.matches).length) return
                if (typeof scopeSelector !== 'string') scopeSelector = undefined
                Object.assign(this, {
                    matches, mode, name, labels: Object.freeze(labels), scopeSelector,
                    defaultValue: typeof defaultValue === 'string' ? defaultValue : (defaultValue != null ? `${defaultValue}` : '')
                })
                const attributes = new Set()
                if (mode) {
                    this.namespace = namespace ? namespace.trim().toLowerCase() : `${mode}-${name}`
                    namespace = this.namespace
                    switch (mode) {
                        case 'audio':
                            for (const a of ['autoplay', 'controls', 'controlslist', 'crossorigin', 'disableremoateplayback', 'loop', 'muted',
                                'preload', 'src']) this.matches[`@${a}`] ??= `audio[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'css':
                            this.matches.textContent ??= `style[data-${namespace}-text-content]`
                            this.matches['@style'] ??= `[data-${namespace}-attr-style][style]`
                            this.matches['@href'] ??= `link[rel="stylesheet"][data-${namespace}-attr-href][href]`
                            for (const a of ['blocking', 'media', 'nonce', 'title']) this.matches[`@${a}`] ??= `style[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'html': this.matches.innerHTML ??= `[data-${namespace}-innerhtml]`; break
                        case 'image':
                            for (const a of ['alt', 'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget', 'height',
                                'src', 'width']) this.matches[`@${a}`] ??= `img[data-${namespace}-attr-${a}][${a}]`
                            this.matches['@poster'] ??= `video[data-${namespace}-attr-poster][poster]`
                            break
                        case 'js':
                            this.matches.textContent ??= `script[type="application/javascript"][data-${namespace}-text-content]`
                            for (const a of ['async', 'attributionsrc', 'blocking', 'crossorigin', 'defer', 'fetchpriority', 'integrity', 'nomodule', 'nonce',
                                'referrerpolicy', 'src', 'type']) this.matches[`@${a}`] ??= `script[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'text/element': this.matches.textContent ??= `script[type="text/element"][data-${namespace}-text-content]`; break
                        case 'video':
                            for (const a of ['autoplay', 'controls', 'controlslist', 'crossorigin', 'disablepictureinpicture', 'disableremoateplayback', 'height', 'loop', 'muted',
                                'playsinline', 'poster', 'preload', 'src', 'width']) this.matches[`@${a}`] ??= `video[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'lang':
                            attributes.add('lang')
                        case 'text':
                            this.matches.textContent ??= `[data-${namespace}-text-content]`
                            this.matches['@title'] ??= `[data-${namespace}-attr-title][title]`
                            this.matches['@alt'] ??= `img[data-${namespace}-attr-alt][alt]`
                            this.matches['@placeholder'] ??= `input[data-${namespace}-attr-placeholder][placeholder]`
                            this.matches['@aria-label'] ??= `[data-${namespace}-attr-aria-label][aria-label]`
                            this.matches['@aria-labelledby'] ??= `[data-${namespace}-attr-aria-labelledby][aria-labelledby]`
                            this.matches['@aria-describedby'] ??= `[data-${namespace}-attr-aria-describedby][aria-describedby]`
                            this.matches['@value'] ??= `input[data-${namespace}-attr-value][value]`
                            this.matches['@content'] ??= `meta[name][data-${namespace}-attr-content][content]`
                            this.matches['@label'] ??= `[data-${namespace}-attr-label][label]`
                    }
                }
                const selectors = {}
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
            }
            async apply(node) {
                const { E } = this.constructor, nodeIsElement = node instanceof HTMLElement, { selectors, name, defaultValue, mode } = this, promises = [],
                    modeIsLang = mode === 'lang', envelope = Object.freeze(await E.createEnvelope(this.envelope ?? {}))
                for (const selector in selectors) {
                    const nodeList = Array.from(node.querySelectorAll(selector)), { key, token: tokenAttr, target: targetAttr } = selectors[selector]
                    if (nodeIsElement && node.matches(selector)) nodeList.push(node)
                    for (const n of nodeList) {
                        const fields = {}, nodeEnvelope = { ...envelope, labels: { ...n.dataset } }, token = E.resolveVariable(n.getAttribute(tokenAttr), nodeEnvelope, { wrapped: false })
                        promises.push(this.engine.run(token, modeIsLang ? (n.closest('[lang]').getAttribute('lang') || undefined) : name, nodeEnvelope).then(tokenValue => {
                            tokenValue ??= defaultValue
                            targetAttr ? n.setAttribute(target, tokenValue) : (n[key] = tokenValue)
                        }))
                    }
                }
                return Promise.all(promises)
            }
            support(node) {
                const { E } = this.constructor, observer = new MutationObserver((mutations) => {
                    const { scopeSelector } = this
                    for (const mutation of mutations) {
                        if (scopeSelector) if (mutation.type === 'childList') for (const addedNode of mutation.addedNodes) if (addedNode.matches(scopeSelector)) this.support(addedNode)
                        this.apply(mutation.target)
                    }
                })
                observer.observe(node, { subtree: true, childList: true, attributeFilter: this.attributeFilter })
                this.observers.set(node, observer)
                this.apply(node)
                if (node.shadowRoot) this.support(node.shadowRoot)
            }
            async run() {
                const { E, validEngineClasses } = this.constructor, { scopeSelector, engine } = this
                if (!engine) return
                if (typeof engine === 'string') {
                    const [engineType, engineName] = engine.trim().split(E.sys.regexp.colonSplitter), validEngine = false
                    this.engine = await E.resolveUnit(engineName, engineType)
                    for (const n of validEngineClasses.keys()) if (validEngine ||= (this.engine instanceof E[n])) break
                    if (!validEngine) return
                }
                let nodes
                if (scopeSelector) {
                    nodes = Array.from(document.querySelectorAll(scopeSelector))
                    if (document.documentElement.matches(scopeSelector)) nodes.push(document.documentElement)
                } else nodes = Array.from(document.getElementsByTagName('*'))
                for (const node of nodes) this.support(node)
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
    Transform: { // optimal
        enumerable: true, value: class {
            static E
            static embeddableClasses = new Set('API', 'Collection', 'AI', 'Transform', 'Language')
            constructor(stepChain, pipelineState = {}) {
                if (!stepChain) return
                const { E } = this.constructor, isMap = ((stepChain instanceof Map) || (this.isPlainObject(stepChain)))
                if (!isMap && !Array.isArray(stepChain)) stepChain = [stepChain]
                this.steps = new Map()
                this.stepIntermediates = new Map()
                for (let [stepKey, stepValue] of stepChain.entries()) {
                    if (!stepValue) continue
                    if (typeof stepKey !== 'string') stepKey = `${stepKey}`
                    else if (typeof stepValue === 'function') this.steps.set(stepKey, step.bind(E))
                    else if (stepValue instanceof Promise) {
                        this.steps.set(stepKey, async (input, envelope) => {
                            if (!this.stepIntermediates.has(stepKey)) {
                                const stepResult = await stepValue
                                if (typeof stepResult === 'function') stepResult = stepResult.bind(E)
                                this.stepIntermediates.set(stepKey, stepResult)
                            }
                            const func = this.stepIntermediates.get(stepKey)
                            return (typeof func === 'function') ? func(input, envelope) : func
                        })
                    }
                    else if (typeof stepValue === 'string') {
                        this.steps.set(stepKey, async (input, envelope) => {
                            const jsonata = (E.app.libraries.jsonata ??= await E.resolveUnit('jsonata', 'library')),
                                expression = this.stepIntermediates.get(stepKey) ?? this.stepIntermediates.set(stepKey, jsonata(`(${step.trim()})`)).get(stepKey)
                            return expression.evaluate(input, { envelope })
                        })
                    }
                    else if (this.isPlainObject(stepValue) && (Object.keys(stepValue).length === 1)) {
                        const { unitType, unitNamePlusIntent } = stepValue.entries()[0], [unitName, unitIntent] = unitNamePlusIntent.split(E.sys.regexp.pipeSplitter),
                            stepClassName = (E.sys.unitTypeMap[unitType] ?? [])[1]
                        if (!this.constructor.embeddableClasses.has(stepClassName)) continue
                        this.steps.set(stepKey, async (input, envelope) => {
                            input = Array.isArray(input) ? input : [input, undefined]
                            const unit = await E.resolveUnit(unitType, unitKey)
                            if (!unit) return
                            return unit(...input, envelope)
                        })
                    }
                }
                this.pipelineState = Object.freeze(this.isPlainObject(pipelineState) ? pipelineState : {})
            }
            async run(input, stepKey, envelope) {
                const { E } = this.constructor, state = { ...this.pipelineState, ...(envelope.state ?? {}) }
                for (const k of state) if (E.isWrappedVariable(k)) state[k] = E.resolveVariable(state[k], envelope, { wrapped: true })
                const pipelineEnvelope = Object.freeze({ ...envelope, state })
                if (stepKey && this.steps.has(stepKey)) return this.steps.get(stepKey)?.call(E, input, pipelineEnvelope)
                let useSteps = stepKey.includes(':') ? E.sliceAndStep(stepKey, this.steps.values()) : this.steps.values()
                for (const step of useSteps) if ((input = await step.call(E, input, pipelineEnvelope)) === undefined) break
                return input
            }
        }
    },
    Type: { // optimal
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
                                const [valid, validation = {}] = await typeDefinition.constructor.run.call(typeDefinition, input, verbose, envelope)
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
                                    const jsonSchema = await E.resolveUnit('schema', 'library')
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
    Validator: { // optimal
        enumerable: true, value: class {
            static E
            static async run(input, verbose, envelope) {
                const instance = this instanceof this.constructor ? this : new this(), validationResults = {}
                let valid = true
                for (const key of Object.keys(instance)) if (typeof instance[key] === 'function') {
                    validationResults[key] = await instance[key](input, envelope)
                    valid = validationResults[key] === true
                    if (!valid && !verbose) return false
                }
                return verbose ? validationResults : true
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
                let fields = (facetInstanceOrContainer instanceof ElementHTML.Facet) ? facetInstanceOrContainer.fields : ((facetInstanceOrContainer instanceof HTMLElement) ? ElementHTML.app._facetInstances.get(facetInstanceOrContainer).fields : undefined)
                if (name && fields[name]) return fields[name]
                super(name, initialValue)
                if (name && fields) fields[name] ??= this
            }
        }
    }
})
const { app, sys } = ElementHTML
for (const k in ElementHTML.env) Object.defineProperty(app, k, { configurable: false, enumerable: true, writable: false, value: {} })
for (const className of ['API', 'Collection', 'Component', 'Facet', 'Gateway', 'Job', 'Language', 'Transform', 'Type', 'Validator']) Object.defineProperty(ElementHTML[className], 'E', { configurable: false, writable: false, value: ElementHTML })
for (const f in ElementHTML.sys.color) ElementHTML.sys.color[f] = ElementHTML.sys.color[f].bind(ElementHTML)
const metaUrl = new URL(import.meta.url), initializationParameters = metaUrl.searchParams, promises = [], functionMap = { compile: 'Compile', dev: 'Dev', expose: 'Expose' }
for (const f in functionMap) if (initializationParameters.has(f)) promises.push(ElementHTML[functionMap[f]](initializationParameters.get(f)))
await Promise.all(promises)
if (initializationParameters.has('packages')) {
    let imports = {}
    const importmapElement = document.head.querySelector('script[type="importmap"]'), importmap = { imports }, importPromises = new Map(), packageList = []
    for (let s of initializationParameters.get('packages').split(',')) if (s = s.trim()) packageList.push(s)
    if (importmapElement) try { imports = Object.assign(importmap, JSON.parse(importmapElement.textContent.trim())).imports } catch (e) { }
    else if (initializationParameters.get('packages')) for (const p of packageList) imports[p] = `./packages/${p}.js`
    else {
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