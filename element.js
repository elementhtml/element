const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '2.0.0' }, // optimal

    env: { // optimal
        enumerable: true, value: {
            ais: {}, apis: {}, components: {}, content: {}, context: {}, facets: {}, gateways: {}, hooks: {},
            interpreters: new Map([
                [/^[#?/:]$/, {
                    name: 'router',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/router', facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor } = envelope, { signal } = descriptor
                        if (signal) window.addEventListener('hashchange', () => facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash.slice(1) })), { signal })
                    },
                    parser: async function (expression) { return { expression, signal: expression === '#' } }
                }],
                [/^(true|false|null|[.!-]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(\.\d+)?)$/, {
                    name: 'value',
                    handler: async function (facet, position, envelope, value) { return envelope.descriptor.value },
                    parser: async function (expression) { return { value: expression in this.sys.valueAliases ? this.sys.valueAliases[expression] : JSON.parse(expression) } }
                }],
                [/^\$\{.*\}$/, {
                    name: 'variable',
                    handler: async function (facet, position, envelope, value) { return this.resolveVariable(envelope.descriptor.expression, Object.freeze({ ...envelope, value })) },
                    parser: async function (expression) { return { expression: expression.slice(2, -1).trim() } }
                }],
                [/^[{](.*?)[}]$|^[\[](.*?)[\]]$|^\?[^ ]+$/, {
                    name: 'shape',
                    handler: async function (facet, position, envelope, value) {
                        const { descriptor } = envelope
                        return this.resolveVariable(descriptor.shape, Object.freeze({ ...envelope, value }))
                    },
                    parser: async function (expression) { return { shape: this.resolveShape(expression) } }
                }],
                [/^#\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'content',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/content', facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { collection: collectionSignature } = descriptor
                        if (!variables?.collection) new Job(async function () { await this.resolveUnit(collectionSignature, 'collection') }, `collection:${collectionSignature}`)
                    },
                    parser: async function (expression) {
                        const [collection, article, lang] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                        return { collection, article, lang }
                    }
                }],
                [/^\(.*\)$/, {
                    name: 'transform',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/transform', facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { transform: transformSignature } = descriptor
                        if (!variables?.transform) new Job(async function () { await this.resolveUnit(transformSignature, 'transform') }, `transform:${transformSignature}`)
                    },
                    parser: async function (expression) { return { transform: expression.slice(1, -1).trim() } }
                }],
                [/^\/.*\/$/, {
                    name: 'pattern',
                    handler: async function (facet, position, envelope, value) { return (await this.runFragment('env/interpreters/pattern')).handler.call(this, facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { pattern: patternSignature } = descriptor
                        if (!variables?.pattern) new Job(async function () { await this.resolveUnit(patternSignature, 'pattern') }, `pattern:${patternSignature}`)
                    },
                    parser: async function (expression) { return (await this.runFragment('env/interpreters/pattern')).parser.call(this, expression) }
                }],
                [/^\|.*\|$/, {
                    name: 'type',
                    handler: async function (facet, position, envelope, value) { return (await this.runFragment('env/interpreters/type')).handler.call(this, facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor } = envelope, { types } = descriptor
                        for (t of types) if (!this.isWrappedVariable(t.name)) new Job(async function () { await this.resolveUnit(t.name, 'type') }, `type:${t}`)
                    },
                    parser: async function (expression) { return (await this.runFragment('env/interpreters/type')).parser.call(this, expression) }
                }],
                [/^\<.*\>$/, {
                    name: 'selector',
                    handler: async function (facet, position, envelope, value) {
                        const { descriptor } = envelope, { scope, selector } = descriptor
                        if (value != undefined) for (const t of ([].concat(await this.resolveSelector(selector, scope)))) this.render(t, value)
                        return value
                    },
                    binder: async function (facet, position, envelope) {
                        const { descriptor } = envelope, { signal } = descriptor, { scope: scopeStatement, selector: selectorStatement } = descriptor,
                            scope = await this.resolveScope(scopeStatement, facet.root), { sys } = this, { defaultEventTypes } = sys
                        if (!scope) return {}
                        const bangIndex = selectorStatement.lastIndexOf('!')
                        let selector = selectorStatement.trim(), eventList
                        if ((bangIndex > selector.lastIndexOf(']')) && (bangIndex > selector.lastIndexOf(')')) && (bangIndex > selector.lastIndexOf('"')) && (bangIndex > selector.lastIndexOf("'")))
                            [selector, eventList] = [selector.slice(0, bangIndex).trim(), selector.slice(bangIndex + 1).trim()]
                        if (eventList) eventList = eventList.split(sys.regexp.commaSplitter).filter(Boolean)
                        else {
                            const [statementIndex, stepIndex] = position.split('-')
                            if (!facet.statements?.[+statementIndex]?.steps[+stepIndex + 1]) return { selector, scope }
                        }
                        for (let eventName of eventList ?? Array.from(new Set(Object.values(defaultEventTypes).concat(['click'])))) {
                            const enSlice3 = eventName.slice(-3), keepDefault = enSlice3.includes('+'), exactMatch = enSlice3.includes('='), once = enSlice3.includes('-')
                            for (const [v, r] of [[keepDefault, '+'], [exactMatch, '='], [once, '-']]) if (v) eventName = eventName.replace(r, '')
                            scope.addEventListener(eventName, event => {
                                let targetElement
                                if (selector.endsWith('}') && selector.includes('{')) {
                                    targetElement = this.resolveSelector(selector, scope)
                                    if (!targetElement || (Array.isArray(targetElement) && !targetElement.length)) return
                                } else if (selector[0] === '$') {
                                    if (selector.length === 1) return
                                    targetElement = exactMatch ? event.target : event.target.closest(selector)
                                    if (!targetElement.matches(this.buildCatchallSelector(selector))) return
                                } else if (selector && exactMatch && !event.target.matches(selector)) return
                                targetElement ??= (exactMatch ? event.target : event.target.closest(selector))
                                if (!targetElement) return
                                if (!eventList && (event.type !== (targetElement.constructor.events?.default ?? defaultEventTypes[targetElement.tagName.toLowerCase()] ?? 'click'))) return
                                if (!keepDefault) event.preventDefault()
                                facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(targetElement, undefined, event) }))
                            }, { signal, once })
                        }
                        return { selector, scope }
                    },
                    parser: async function (expression) { return { signal: true, ...(await this.resolveScopedSelector(expression.slice(2, -1))) } }
                }],
                [/^[#@](?:[a-zA-Z0-9]+|[{][a-zA-Z0-9#@?!, ]*[}]|[\[][a-zA-Z0-9#@?!, ]*[\]])$/, {
                    name: 'state',
                    handler: async function (facet, position, envelope, value) { return (await this.runFragment('env/interpreters/state')).handler.call(this, facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor } = envelope, { signal, shape } = descriptor, items = []
                        let { target } = descriptor, getReturnValue
                        switch (shape) {
                            case 'single':
                                const { type, name } = target
                                target[type] = type === 'field' ? (new this.Field(name, facet)) : (new this.Cell(name))
                                getReturnValue = () => target[type].get()
                                items.push(target)
                                break
                            case 'array':
                                for (const t of target) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(t.name, facet)) : (new this.Cell(t.name))
                                getReturnValue = (r = [], l) => {
                                    for (const t of target) if ((r[l ??= r.length] = t[t.type].get()) === undefined) return
                                    return r
                                }
                                break
                            case 'object':
                                if (Array.isArray(target)) target = Object.fromEntries(target)
                                for (const t of Object.values(target)) (items[items.length] = t)[t.type] = t.type === 'field' ? (new this.Field(t.name, facet)) : (new this.Cell(t.name))
                                getReturnValue = (r = {}, tk) => {
                                    for (const k in target) if ((r[k] = (tk = target[k])[tk.type].get()) === undefined) return
                                    return r
                                }
                        }
                        for (const item of items) {
                            item[item.type].eventTarget.addEventListener('change', () => {
                                const detail = getReturnValue()
                                if (detail !== undefined) facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                            }, { signal })
                        }
                        return { getReturnValue, target }
                    },
                    parser: async function (expression) { return (await this.runFragment('env/interpreters/state')).parser.call(this, expression) }
                }],
                [/^!\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'api',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/api', facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { api: apiSignature } = descriptor
                        if (!variables?.api) new Job(async function () { await this.resolveUnit(apiSignature, 'api') }, `api:${apiSignature}`)
                    },
                    parser: async function (expression) {
                        const [api, action] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                        return { api, action }
                    }
                }],
                [/^@\`[^`]+(\|[^`]+)?\`$/, {
                    name: 'ai',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/ai', facet, position, envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { ai: aiSignature, } = descriptor
                        if (!variables?.ai) new Job(async function () { await this.resolveUnit(aiSignature, 'ai') }, `ai:${aiSignature}`)
                    },
                    parser: async function (expression) {
                        const [ai, prompt] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                        return { ai, prompt }
                    }
                }],
                [/^`[^`]+(\|[^`]+)?`$/, {
                    name: 'request',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/request', envelope, value) },
                    binder: async function (facet, position, envelope) {
                        const { descriptor, variables } = envelope, { contentType } = descriptor
                        if (!variables?.contentType) new Job(async function () { await this.resolveUnit(contentType, 'transform') }, `transform:${contentType}`)
                    },
                    parser: async function (expression) {
                        const [url, contentType] = this.expression.slice(1, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                        return { url, contentType }
                    }
                }],
                [/^_.*_$/, {
                    name: 'wait',
                    handler: async function (facet, position, envelope, value) { return await this.runFragment('env/interpreters/wait', facet, position, envelope, value) },
                    parser: async function (expression) { return { expression: expression.slice(1, -1).trim() } }
                }],
                [/^\$\`[^`]+\`$/, {
                    name: 'command',
                    handler: async function (facet, position, envelope, value) { return this.modules.dev ? (await this.runFragment('env/interpreters/command', envelope, value)) : value },
                    parser: async function (expression) { return { invocation: expression.slice(2, -1).trim() } }
                }],
                [/^\$\??$/, {
                    name: 'console',
                    handler: async function (facet, position, envelope, value) {
                        return this.modules.dev
                            ? ((envelope.descriptor.verbose === true ? (console.log(await this.flatten({ facet, position, envelope, value }))) : (console.log(value))) ?? value) : value
                    },
                    parser: async function (expression) { return { verbose: expression === '$?' } }
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
            return Object.freeze({ ...(this.isPlainObject(value) ? value : { value }), cells: await this.flatten(this.app.cells), context: Object.freeze({ ...this.env.context, ...this.app.context }) })
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
    flatten: { enumerable: true, value: async function (value, event) { return this.runFragment('flatten', value, event) } }, // optimal
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
        enumerable: true, value: function (scopeStatement, element) {
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
            if (impliedScopes[scopedSelector]) return element ? (this.resolveScope(impliedScopes[scopedSelector], element)) : { scope: impliedScopes[scopedSelector] }
            if (impliedScopes[scopedSelector[0]]) scopedSelector = `${impliedScopes[scopedSelector[0]]}|${scopedSelector}`
            let scope = element
            if (pipeSplitter.test(scopedSelector)) {
                const [scopeStatement, selectorStatement] = scopedSelector.split(pipeSplitter, 2).map(s => s.trim())
                if (!element) return { scope: scopeStatement, selector: selectorStatement }
                scope = this.resolveScope(scopeStatement, element)
                scopedSelector = selectorStatement
            }
            return element ? (await this.resolveSelector(scopedSelector, scope)) : { selector: scopedSelector }
        }
    },
    resolveSelector: {  // optimal
        enumerable: true, value: async function (selector, scope) {
            scope ??= document.documentElement
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
        enumerable: true, value: async function (unitKey, unitType, asUnitKey) {
            if (!unitKey || !unitType) return
            const unitKeyTest = Array.isArray(unitKey) ? 'array' : (this.isPlainObject(unitKey) ? 'object' : undefined)
            if (unitKeyTest) {
                const isArray = unitKeyTest === 'array', result = isArray ? [] : {}, keys = isArray ? unitKey : Object.keys(unitKey),
                    asKeysIsArray = Array.isArray(asUnitKey) && asUnitKey.length, asKeysIsObject = !asKeysIsArray && (this.isPlainObject(asUnitKey))
                for (const k of keys) result[isArray ? result.length : k] = await this.resolveUnit(k, unitKey[k],
                    ((isArray && asKeysIsArray) || asKeysIsObject) ? asUnitKey[k] : undefined)
                return result
            }
            if (unitType === 'resolver') return this.defaultResolver.bind(this)
            const { sys, app } = this, [unitTypeCollectionName, unitClassName] = sys.unitTypeMap[unitType], unitClass = typeof unitClassName === 'string' ? this[unitClassName] : unitClassName
            if (typeof unitKey !== 'string') return (unitKey instanceof unitClass) ? unitKey : undefined
            if (!(unitKey = unitKey.trim())) return
            let unit = app[unitTypeCollectionName][asUnitKey ?? unitKey]
            if (unit) return unit
            const { queue } = sys, unitQueueJob = queue.get(`${unitType}:${asUnitKey ?? unitKey}`)
                ?? queue.get(`${unitTypeCollectionName}:${asUnitKey ?? unitKey}`)
            if (unitQueueJob) {
                await unitQueueJob.completed()
                if (unit = app[unitTypeCollectionName][asUnitKey ?? unitKey]) return unit
            }
            const envUnit = this.env[unitTypeCollectionName][unitKey]
            let unitResolver
            if (envUnit) {
                if ((typeof envUnit === 'function') && !(envUnit instanceof unitClass)) await envUnit(this)
                else if (envUnit instanceof Promise) envUnit = await envUnit
                else if (typeof envUnit === 'string') unitResolver = await this.resolveUnit(unitType, 'resolver', asUnitKey) ?? this.defaultResolver
                return app[unitTypeCollectionName][asUnitKey ?? unitKey] = unitResolver ? await unitResolver.call(this, envUnit, unitType, asUnitKey ?? unitKey) : envUnit
            }
            if (this.sys.localOnlyUnitTypes.has(unitType)) return
            unitResolver ??= await this.resolveUnit(unitType, 'resolver', asUnitKey) ?? this.defaultResolver
            return app[unitTypeCollectionName][asUnitKey ?? unitKey] = await unitResolver.call(this, unitKey, unitType, asUnitKey)
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
            defaultValue: /\s+\?\?\s+(.+)\s*$/,
            directiveHandleMatch: /^([A-Z][A-Z0-9]*)::\s(.*)/,
            impliedScopes: Object.freeze({ ':': 'body', '#': 'html' }),
            label: /^([\@\#]?[a-zA-Z0-9]+[\!\?]?):\s+/,
            localOnlyUnitTypes: new Set(['hook']),
            locationKeyMap: { '#': 'hash', '/': 'pathname', '?': 'search' },
            queue: new Map(),
            regexp: Object.freeze({
                commaSplitter: /\s*,\s*/, colonSplitter: /\s*\:\s*/, dashUnderscoreSpace: /[-_\s]+(.)?/g, directiveHandleMatch: /^(?:(?<handle>[A-Z][A-Z0-9]*)::\s*)(?<directive>.*)?$/, extractAttributes: /(?<=\[)([^\]=]+)/g, gatewayUrlTemplateMergeField: /{([^}]+)}/g,
                lowerCaseThenUpper: /([a-z0-9])([A-Z])/g, upperCaseThenAlpha: /([A-Z])([A-Z][a-z])/g, hasVariable: /\$\{(.*?)\}/g, isFormString: /^\w+=.+&.*$/,
                isHTML: /<[^>]+>|&[a-zA-Z0-9]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/, isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, leadingSlash: /^\/+/, nothing: /^(.)/, notAlphaNumeric: /[^a-zA-Z0-9]/,
                periodSplitter: /\s*\.\s*/,
                pipeSplitter: /(?<!\|)\|(?!\|)(?![^\[]*\])/, pipeSplitterAndTrim: /\s*\|\s*/, dash: /-/g, xy: /[xy]/g, selectorBranchSplitter: /\s*,\s*(?![^"']*["'][^"']*$)/,
                selectorSegmentSplitter: /(?<=[^\s>+~|\[])\s+(?![^"']*["'][^"']*$)|\s*(?=\|\||[>+~](?![^\[]*\]))\s*/, spaceSplitter: /\s+/
            }),
            resolveShape: Object.freeze({ startFlags: new Set(['[', '?', '{']), endFlags: Object.freeze({ '.': true, '!': false, '-': null, '?': undefined }), closers: Object.freeze({ '{': '}', '[': ']' }) }),
            segmenter: /\s+>>\s+/g,
            splitter: /\n(?!\s+>>)/gm,
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
            urlAttributes: Object.freeze(['href', 'src']),
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
                    case 'string': if ((await fetch(`${window.location.protocol}//${head}`, { method: 'HEAD' })).ok) connection = true; break
                    case 'function': connection = await head.bind(this, { as: 'head', ctx, protocol })(); break
                }
                if (!connection) continue
                let useGateway = typeof gateway === 'function' ? gateway.bind(this, { as: 'gateway', connection, ctx, protocol }) : gateway
                if (auto) this.app._observers.set(useGateway, this.observeUrlAttributes())
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
            if ((element instanceof HTMLMetaElement && element.name.startsWith('e-'))) {
                let [unitType, asUnitKey] = element.name.slice(2).toLowerCase().trim().split(this.sys.regexp.periodSplitter)
                unitType = this.sys.unitTypeCollectionNameToUnitTypeMap[unitType] ?? unitType
                if (unitType in this.sys.unitTypeMap) promises.push(this.resolveUnit(element.content.trim(), unitType, asUnitKey))
            }
            if (element.shadowRoot?.children) for (const n of element.shadowRoot.children) promises.push(this.mountElement(n))
            for (const n of element.children) promises.push(this.mountElement(n))
            return Promise.all(promises)
        }
    },
    observeUrlAttributes: { // optimal
        value: function (observedScope = document.documentElement, resolveUrl = undefined, urlAttributes = undefined) {
            if (typeof resolveUrl !== 'function') resolveUrl ??= this.resolveUrl
            urlAttributes ??= this.sys.urlAttributes
            const observer = new MutationObserver(records => {
                for (const { type, target, attributeName, addedNodes } of records) {
                    if (type !== 'attributes' && type !== 'childList') continue
                    const [targets, processAttributes] = type === 'attributes' ? [[target], [attributeName]] : [addedNodes, urlAttributes]
                    this.resolveUrlAttributes(targets, processAttributes, resolveUrl)
                }
            })
            observer.observe(observedScope, { subtree: true, childList: true, attributes: true, attributeFilter: urlAttributes })
            return observer
        }
    },
    processQueue: { // optimal
        value: async function () {
            for (const job of this.sys.queue.values()) job.run()
            await new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve) : setTimeout(resolve, 100))
            this.processQueue()
        }
    },
    resolveUrlAttributes: { // optimal
        value: function (targets, urlAttributes, resolveUrl) {
            urlAttributes ??= this.sys.urlAttributes
            if (typeof resolveUrl !== 'function') resolveUrl ??= this.resolveUrl
            for (const target of targets) {
                if (!(target instanceof HTMLElement)) continue
                for (const attributeName of urlAttributes) {
                    const attributeValue = target.getAttribute(attributeName)
                    if (!attributeValue) continue
                    let valueUrl
                    try { valueUrl = new URL(attributeValue, document.baseURI) } catch (e) { continue }
                    if (valueUrl.protocol === protocol) {
                        const resolvedUrl = resolveUrl.call(this, attributeValue)
                        let resolveUrlObj
                        try { resolveUrlObj = new URL(resolvedUrl) } catch (e) { continue }
                        if (resolveUrlObj.protocol !== protocol) target.setAttribute(attributeName, resolvedUrl)
                    }
                }
            }
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
    unmountElement: { value: async function (element) { return this.runFragment('unmountelement', element) } }, // optimal

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
            async run(input, promptTemplateKey, envelope) { return (await this.constructor.E.runFragment('ai')).run.call(this, input, promptTemplateKey, envelope) }
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
            async run(value, action, envelope) { return (await this.constructor.E.runFragment('api')).run.call(this, value, action, envelope) }
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
            async run(slug, lang, envelope) { return (await this.constructor.E.runFragment('collection')).run.call(this, slug, lang, envelope) }
        }
    },
    Component: {
        enumerable: true, value: class extends HTMLElement {
            static E
            static base = {}
            static events = {}
            static facet
            static mode = "open"
            static name
            static layout
            static package = {}
            static get observedAttributes() { return (super.observedAttributes || []).concat([]) }
            #observer
            #resolveScopedUrl(url) {
                if (!url) return
                for (const p of ['component', 'components', 'package']) if (url.startsWith(`${p}://`)) return url.replace(`${p}:/`, base[p]).replace('//', '/')
                return E.resolveUrl(url, base.component)
            }
            constructor() {
                const { E, base } = this.constructor
                base.package ??= E.resolveUrl('./')
                base.components ??= E.resolveUrl('./components/', base.package)
                this.constructor.layout ??= 'layout.html'
            }
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            connectedCallback() {
                const { E, base, mode, layout, facet: constructorFacet } = this.constructor, [packageKey, ...componentPathParts] = this.tagName.toLowerCase().split('-'),
                    componentName = componentPathParts.slice(-1)[0], componentPath = componentPathParts.join('/')
                this.constructor.package.key ??= packageKey
                base.component ??= E.resolveUrl(componentPath, base.components)
                this.constructor.name ??= componentName
                if (layout) {
                    this.attachShadow({ mode: mode || 'open' })
                    Promise.resolve(new Promise(res => {
                        if (layout instanceof HTMLTemplateElement) res(layout.content.cloneNode(true).textContent)
                        else if (layout instanceof Promise) res(layout)
                        else if (typeof layout === 'string') {
                            fetch(E.resolveUrl(layout, base.component)).then(r => r.text()).then(t => {
                                const templateElement = document.createElement('template')
                                templateElement.textContent = t
                                this.constructor.layout = templateElement
                                res(templateElement.content.cloneNode(true).textContent)
                            })
                        }
                        else res()
                    })).then(layoutHtml => {
                        if (layoutHtml === undefined) return
                        const fields = Object.freeze({ ...this.dataset }), labels = Object.freeze(E.flatten(this.valueOf()))
                        E.createEnvelope({ labels, fields }).then(envelope => {
                            this.shadowRoot.innerHTML = E.resolveVariable(layoutHtml, envelope, { merge: true })
                            let urlAttributesSelector = ''
                            for (const a of this.sys.urlAttributes) urlAttributesSelector += `[${a}]`
                            this.resolveUrlAttributes(this.shadowRoot.querySelectorAll(urlAttributesSelector), this.sys.urlAttributes)
                            this.#observer = this.observeUrlAttributes(this.shadowRoot, this.#resolveScopedUrl)
                            this.dispatchEvent(new CustomEvent('ready', { detail: this }))
                            this.readyCallback()
                        })
                    })
                }
                const { facet } = this
                if (facet) {
                    if (constructorFacet) {
                        Promise.resolve(constructorFacet).then(facetData => {
                            this.facet = facetData instanceof E.Facet ? facetData : new E.Facet({ ...facetData, root: this.shadowRoot })
                        });
                    } else {
                        constructor.facet = (facet instanceof Promise ? facet
                            : (typeof facet === 'string' ? fetch(E.resolveUrl(facet, base.component)).then(r => r.text()).then(t => ({ directives: t })) : Promise.resolve(facet))
                        ).then(async resolvedFacet => {
                            let facetData
                            if (resolvedFacet instanceof E.Facet) facetData = resolvedFacet
                            else if (E.isPlainObject(resolvedFacet)) {
                                const facetInstance = new E.Facet({ ...resolvedFacet, root: this.shadowRoot })
                                facetData = await facetInstance.export()
                            }
                            this.facet = facetData instanceof E.Facet ? facetData : new E.Facet({ ...facetData, root: this.shadowRoot })
                            constructor.facet = facetData
                            return facetData
                        })
                    }
                }
            }
            disconnectedCallback() {
                if (this.#observer) this.#observer.disconnect()
                super.disconnectedCallback()
                if (this.facet) this.facet.stop()
            }
            dispatchEvent(event) {
                const { E } = this.constructor, eventProps = { detail: event.detail, bubbles: event.bubbles, cancelable: event.cancelable, composed: event.composed },
                    defaultEventTypes = E.sys
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
            readyCallback() { }
            toJSON() { return this.valueOf() }
            valueOf() {
                const result = {}
                for (const p of this.constructor.observedAttributes.concat('value')) result[p] = this[p]
                return result
            }
        }
    },
    Facet: {
        enumerable: true, value: class {
            static E
            static saveToLabel(stepIndex, label, value, labelMode, labels, fields, cells) {
                labels[`${stepIndex}`] = value
                if (label && (label != stepIndex)) {
                    switch (label[0]) {
                        case '@': fields[label.slice(1)].set(value, labelMode); break
                        case '#': cells[label.slice(1)].set(value, labelMode); break
                        default: labels[label] = value
                    }
                }
            }
            conditionsAnchorObservers = {}
            conditions = { dom: {}, location: {}, cells: {}, fields: {}, host: {} }
            #controller
            #controllers = {}
            descriptors = {}
            eventTarget
            fields = {}
            inited
            labels = {}
            running
            statements = []
            constructor(params = {}) {
                if (typeof params === 'string') params = { directives: params }
                const { conditions, directives, statements, fields, running, root } = params
                if (!(directives || statements)) return
                let promise = (statements && fields && Array.isArray(statements) && this.constructor.E.isPlainObject(fields))
                    ? this.constructor.setupStatements(statements, fields) : ((typeof directives === 'string') ? this.parseDirectives(directives) : undefined)
                if (!promise) return
                this.root = (root instanceof ShadowRoot) ? root : document.documentElement
                this.#controller = new AbortController()
                this.eventTarget = new EventTarget()
                this.running = running ?? true
                const { E } = this.constructor
                if (conditions && E.isPlainObject(conditions)) promise = Promise.all([promise, this.setupConditions(conditions)])
                promise.then(() => this.init())
            }
            async export() {
                if (this.inited) return { statements: this.statements, fields: this.fields }
                await new Promise((resolve) => (() => (this.inited ? resolve() : setTimeout(checkInit, 10)))())
                return { statements: this.statements, fields: this.fields }
            }
            async init() {
                Object.freeze(this.statements)
                Object.freeze(this.fields)
                const { E, saveToLabel } = this.constructor, { interpreters } = E.env, interpreterKeys = Array.from(interpreters.keys()), { descriptors, eventTarget, statements } = this
                let statementIndex = -1
                for (const statement of statements) {
                    statementIndex++
                    const { steps = [] } = statement, labels = {}
                    for (const label in statement.labels) labels[label] = undefined
                    this.labels[statementIndex] = labels
                    let stepIndex = -1
                    for (const step of steps) {
                        stepIndex++
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, defaultExpression, stepEnvelope } = step, { interpreter: interpreterKey, variables } = stepEnvelope,
                            descriptor = { ...(stepEnvelope.descriptor ?? {}) }, { signal } = descriptor,
                            envelope = await E.createEnvelope({ ...stepEnvelope, descriptor, fields: Object.freeze(this.valueOf()), labels, variables })
                        let interpreter, matcher
                        for (matcher of interpreterKeys) if (matcher.toString() === interpreterKey) break
                        if (matcher) interpreter = interpreters.get(matcher)
                        if (!interpreter) continue
                        const { binder, handler } = interpreter
                        if (signal) descriptor.signal = (this.#controllers[position] = new AbortController()).signal
                        if (binder) Object.assign(descriptor, (await binder.call(E, this, position, envelope) ?? {}))
                        descriptors[position] = Object.freeze(descriptor)
                        eventTarget.addEventListener(`done-${position}`, async event => saveToLabel(stepIndex, label, event.detail, labelMode, labels, this.fields, E.app.cells), { signal: this.#controller.signal })
                        const previousStepIndex = stepIndex ? stepIndex - 1 : undefined
                        eventTarget.addEventListener(stepIndex ? `done-${statementIndex}-${previousStepIndex}` : 'init', async () => {
                            if (!this.running) return
                            const handlerEnvelope = await E.createEnvelope({ ...envelope, fields: Object.freeze(this.valueOf()), labels: Object.freeze({ ...labels }) }),
                                value = previousStepIndex !== undefined ? labels[`${previousStepIndex}`] : undefined, detail = await handler.call(E, this, position, handlerEnvelope, value)
                                    ?? (defaultExpression ? E.resolveVariable(defaultExpression, { ...handlerEnvelope, value }) : undefined)
                            if (detail !== undefined) eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                        }, { signal: this.#controller.signal })
                    }
                }
                eventTarget.dispatchEvent(new CustomEvent('init'))
                this.inited = true
            }
            async parseDirectives(directives) { return (await this.constructor.E.runFragment('facet')).parseDirectives.call(this, directives) }
            async pause() { return (this.running = false) }
            async run() { return (this.running = true) }
            async setupConditions(conditions) { return (await this.constructor.E.runFragment('facet')).setupConditions.call(this, conditions) }
            async setupStatements(statements, fields) {
                for (const statement of statements) {
                    if (!(statement?.labels && statement?.steps)) continue
                    Object.seal(statement.labels)
                    Object.freeze(statement.steps)
                    Object.freeze(statement)
                    this.statements.push(statement)
                }
                for (const name in fields) new E.Field(name, fields[name], this)
            }
            async stop() {
                this.#controller.abort()
                for (const p in this.#controllers) this.#controllers[p].abort()
                for (const c in this.conditionsAnchorObservers) this.conditionsAnchorObservers[c].disconnect()
            }
            toJSON() { return this.valueOf() }
            valueOf() {
                const fields = {}
                for (const f in this.fields) fields[f] = this.fields[f].value
                return fields
            }
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
            async preload(langCode) { return (await this.constructor.E.runFragment('language')).preload.call(this, langCode) }
            async run(token, langCode, envelope) { return (await this.constructor.E.runFragment('language')).run.call(this, token, langCode, envelope) }
        }
    },
    Model: { // optimal
        enumerable: true, value: class {
            static E
            constructor({ inference, library, load, name, options = {} }) {
                if (!((library && (typeof library === 'string')) && (typeof load === 'function') && (typeof inference === 'function'))) return
                this.inference = inference.bind(this)
                this.name = name ?? this.constructor.E.generateUuid()
                new this.constructor.E.Job(async function () { await this.load(library, load, options) }, `model:${this.name}`)
            }
            async load(library, load, options) { return (await this.constructor.E.runFragment('model')).load.call(this, library, load, options) }
            async run(input) { return (await this.constructor.E.runFragment('model')).run.call(this, input) }
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
                Object.assign(this, { matches, mode, name, labels: Object.freeze(labels), scopeSelector, defaultValue: typeof defaultValue === 'string' ? defaultValue : (defaultValue != null ? `${defaultValue}` : '') })
                const attributes = new Set(), audioVideoAttrs = ['autoplay', 'controls', 'controlslist', 'crossorigin', 'disableremoateplayback', 'loop', 'muted', 'preload', 'src']
                if (mode) {
                    this.namespace = namespace ? namespace.trim().toLowerCase() : `${mode}-${name}`
                    namespace = this.namespace
                    switch (mode) {
                        case 'audio':
                            for (const a of audioVideoAttrs) this.matches[`@${a}`] ??= `audio[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'css':
                            this.matches.textContent ??= `style[data-${namespace}-text-content]`
                            this.matches['@style'] ??= `[data-${namespace}-attr-style][style]`
                            this.matches['@href'] ??= `link[rel="stylesheet"][data-${namespace}-attr-href][href]`
                            for (const a of ['blocking', 'media', 'nonce', 'title']) this.matches[`@${a}`] ??= `style[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'html': this.matches.innerHTML ??= `[data-${namespace}-innerhtml]`; break
                        case 'image':
                            for (const a of ['alt', 'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget', 'height', 'src', 'width']) this.matches[`@${a}`] ??= `img[data-${namespace}-attr-${a}][${a}]`
                            this.matches['@poster'] ??= `video[data-${namespace}-attr-poster][poster]`
                            break
                        case 'js':
                            this.matches.textContent ??= `script[type="application/javascript"][data-${namespace}-text-content]`
                            for (const a of ['async', 'attributionsrc', 'blocking', 'crossorigin', 'defer', 'fetchpriority', 'integrity', 'nomodule', 'nonce', 'referrerpolicy', 'src', 'type']) this.matches[`@${a}`] ??= `script[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'text/element': this.matches.textContent ??= `script[type="text/element"][data-${namespace}-text-content]`; break
                        case 'video':
                            for (const a of [...audioVideoAttrs, 'disablepictureinpicture', 'height', 'playsinline', 'poster', 'width']) this.matches[`@${a}`] ??= `video[data-${namespace}-attr-${a}][${a}]`
                            break
                        case 'lang':
                            attributes.add('lang')
                        case 'text':
                            this.matches.textContent ??= `[data-${namespace}-text-content]`
                            for (const a of ['alt', 'label', 'placeholder', 'title', 'aria-label', 'aria-labelledby', 'aria-describedbd']) this.matches[`@${a}`] ??= `[data-${namespace}-attr-${a}][${a}]`
                            this.matches['@value'] ??= `input[data-${namespace}-attr-value][value]`
                            this.matches['@content'] ??= `meta[name][data-${namespace}-attr-content][content]`
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
            async apply(node) { return (await this.constructor.E.runFragment('renderer')).apply.call(this, node) }
            support(node) {
                const observer = new MutationObserver((mutations) => {
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
            async run() { return (await this.constructor.E.runFragment('renderer')).run.call(this) }
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
            async run(input, stepKey, envelope) { return (await this.constructor.E.runFragment('transform')).run.call(this, input, stepKey, envelope) }
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
            async run(input, verbose, envelope) { return this.engine(input, verbose, envelope) }
        }
    },
    Validator: { // optimal
        enumerable: true, value: class {
            static E
            static async run(input, verbose, envelope) { return (await this.E.runFragment('job')).run.call(this, input, verbose, envelope) }
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
            constructor(name, initialValue, facet) {
                let fields = (facet instanceof ElementHTML.Facet) ? facet.fields : ((facet instanceof HTMLElement) ? ElementHTML.app._facetInstances.get(facet).fields : undefined)
                if (name && fields[name]) return fields[name]
                super(name, initialValue)
                if (name && fields) fields[name] ??= this
            }
        }
    }
})
const { app } = ElementHTML
for (const k in ElementHTML.env) Object.defineProperty(app, k, { configurable: false, enumerable: true, writable: false, value: {} })
for (const className of ['API', 'Collection', 'Component', 'Facet', 'Gateway', 'Job', 'Language', 'Transform', 'Type', 'Validator']) Object.defineProperty(ElementHTML[className], 'E', { configurable: false, writable: false, value: ElementHTML })
const metaUrl = new URL(import.meta.url), initializationParameters = metaUrl.searchParams, promises = [], functionMap = { compile: 'Compile', dev: 'Dev', expose: 'Expose' }
for (const f in functionMap) if (initializationParameters.has(f)) promises.push(ElementHTML[functionMap[f]](initializationParameters.get(f)))
await Promise.all(promises)
if (initializationParameters.has('packages')) {
    let imports = {}
    const importmapElement = document.head.querySelector('script[type="importmap"]'), importmap = { imports }, importPromises = new Map(), packageList = []
    for (let s of initializationParameters.get('packages').split(',')) if (s = s.trim()) packageList.push(s)
    if (importmapElement) try { imports = Object.assign(importmap, JSON.parse(importmapElement.textContent.trim())).imports } catch (e) { }
    else if (initializationParameters.get('packages')) for (const p of packageList) {
        imports[p] = (p.startsWith('/') || p.startsWith('./') || p.startsWith('../')) ? p : (p.startsWith('~') ? `/packages/${p.slice(1)}` : `./packages/${p}`)
        if (!imports[p].endsWith('.js')) imports[p] = `${imports[p]}.js`
    }
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