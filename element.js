const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '0.9.5' },

    env: {
        enumerable: true, value: Object.defineProperties({}, {
            eDataset: { enumerable: true, value: new EventTarget() },
            gateways: {
                enumerable: true, value: {
                    ipfs: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipfs.dweb.link/')}`,
                    ipns: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipns.dweb.link/')}`
                }
            },
            libraries: { enumerable: true, value: {} },
            map: { value: new WeakMap() },
            modes: {
                configurable: true, enumerable: true, writable: true, value: {
                    element: 'element/element.html', content: 'content/content.html', data: 'data/data.json',
                    theme: 'theme/theme.css', schema: 'schema/schema.schema.json', plugin: 'plugin/plugin.js',
                    publish: 'publish/manifest.json', pod: 'pod/db.js'
                }
            },
            options: {
                enumerable: true, value: Object.defineProperties({}, {
                    ajv: {
                        enumerable: true, value: {
                            allErrors: true, verbose: true, validateSchema: 'log', coerceTypes: true,
                            strictSchema: false, strictTypes: false, strictTuples: false, allowUnionTypes: true, allowMatchingProperties: true
                        }
                    },
                    errors: { enumerable: true, value: 'hide' },
                    remarkable: {
                        enumerable: true, value: {
                            html: true
                        }
                    },
                    security: { enumerable: true, value: { allowTemplateUseScripts: false, allowTemplateUseCustom: [] } }
                })
            },
            proxies: { enumerable: true, value: {} },
            sources: {
                enumerable: true, value: {
                    jsonata: 'https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js',
                    remarkable: 'https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm'
                }
            },
            variables: { enumerable: true, value: {} }
        })
    },

    utils: {
        enumerable: true, value: Object.defineProperties({}, {
            getContentType: {
                enumerable: true, value: function (element, src) {
                    let contentType = (this.optionsMap ?? {})['Content-Type'] || (this.optionsMap ?? {})['content-type'] || element.getAttribute('content-type') || element._contentType || undefined
                    if (src) {
                        contentType ||= src.endsWith('.js') ? 'application/javascript' : undefined
                        contentType ||= src.endsWith('.mjs') ? 'application/javascript' : undefined
                        contentType ||= src.endsWith('.wasm') ? 'application/wasm' : undefined
                        contentType ||= 'application/javascript'
                    }
                    if (contentType && !contentType.includes('/')) contentType = `application/${contentType}`
                    return contentType
                }
            },
            getCustomTag: {
                enumerable: true, value: function (element) {
                    return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                        || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
                }
            },
            getVariableResult: {
                enumerable: true, value: function (modVar, args, element) {
                    let result
                    if (typeof modVar === 'string') {
                        result = modVar
                        for (let [i, v] of args.entries()) {
                            let [marker, merger] = (v.includes('=') ? v.split('=').map(s => s.trim()) : [i, v])
                                .map(tk => this.resolveMergeToken(tk, element))
                            result = result.replace(new RegExp(marker, 'g'), merger)
                        }
                    } else if (typeof modVar === 'function') { result = modVar(...args.map(a => this.resolveMergeToken(a, element))) }
                    return result
                }
            },
            getWasm: {
                enumerable: true, value: async function (req, options) {
                    if (typeof req === 'string') req = fetch(req, options)
                    return await WebAssembly.instantiateStreaming(req)
                }
            },
            parseObjectAttribute: {
                enumerable: true, value: function (value, element) {
                    let retval = null
                    if (value instanceof Object) {
                        retval = value
                    } else if (typeof value === 'string') {
                        if (value[0] === '$') return ElementHTML.getVariable(value, element) ?? retval
                        if (value[0] === '?') value = decodeURIComponent(value).slice(1)
                        if ((value[0] === '{') && (value.slice(-1) === '}')) {
                            try { retval = JSON.parse(value) } catch (e) { }
                        } else {
                            try { retval = Object.fromEntries((new URLSearchParams(value)).entries()) } catch (e) { }
                        }
                    }
                    return retval
                }
            },
            processError: {
                enumerable: true, value: function (name, message, element, cause, detail = {}) {
                    detail = { ...detail, ...{ name, message, element, cause } }
                    if (element) element.dispatchEvent(new CustomEvent(`${name}Error`, { detail }))
                    let errors = element?.errors ?? this.env.options.errors
                    if (errors === 'throw') { throw new Error(message, { cause: detail }); return } else if (errors === 'hide') { return }
                }
            },
            resolveForElement: {
                enumerable: true, value: function (element, tagName, conditions = {}, searchBody = false, equals = {}, startsWith = {}, includes = {}) {
                    let resolved
                    const testNode = (node, useConditions = false) => {
                        if (useConditions) for (const [attrName, testValue] of Object.entries(conditions)) if (node.getAttribute(attrName) != testValue) return
                        for (const [attrName, testValue] of Object.entries(equals)) if (node.getAttribute(attrName) == testValue) return node
                        for (const [attrName, testValue] of Object.entries(startsWith)) if (node.getAttribute(attrName).startsWith(testValue)) return node
                        for (const [attrName, testValue] of Object.entries(includes)) if (` ${node.getAttribute(attrName)} `.includes(testValue)) return node
                        if (!Object.keys(equals).length && !Object.keys(startsWith).length && !Object.keys(includes).length) return node
                    }, query = Object.keys(conditions).length ? `${tagName}[${Object.entries(conditions).map(e => e[0] + '="' + e[1] + '"').join('][')}]` : tagName
                    for (const m of element.querySelectorAll(query)) if (resolved = testNode(m)) break
                    if (resolved) return resolved
                    const rootNode = element.shadowRoot || element.getRootNode()
                    if (rootNode instanceof ShadowRoot) {
                        for (const m of rootNode.querySelectorAll(query)) if (resolved = testNode(m)) break
                        return resolved || this.resolveForElement(rootNode.host.getRootNode(), tagName, conditions, searchBody, equals, startsWith, includes)
                    } else {
                        for (const m of document.head.getElementsByTagName(tagName)) if (resolved = testNode(m, true)) break
                        if (searchBody) for (const m of document.body.querySelectorAll(query)) if (resolved = testNode(m)) break
                        return resolved
                    }
                }
            },
            resolveGlobal: {
                enumerable: true, value: function (bindStatement, element) {
                    const statement = bindStatement.trim().match(/([A-Za-z]+)?(\(([^)]*)\))?/).slice(1, 3).map(v => v ||= '').map(v => v.slice(v[0] === '(' ? 1 : 0, v.endsWith(')') ? -1 : v.length).split(',').map(ss => ss.trim()).filter(sss => sss))
                    if (!(statement[0] ?? []).length || !window[statement[0][0]]) return
                    statement[1] ||= []
                    if (statement[1].length && (typeof window[statement[0][0]] !== 'function')) return
                    statement[1].map(a => element.E.getVariable(a, element))
                    const globalObject = (typeof window[statement[0][0]] === 'function' && window[statement[0][0]].prototype) ? (new window[statement[0][0]](...statement[1])) : window[statement[0][0]]
                    return globalObject
                }
            },
            resolveMergeToken: {
                enumerable: true, value: function (token, element) {
                    if (!token) return '$0'
                    if (typeof token === 'number') return `$${token}`
                    if (token[0] === '.') return element[token.slice(1)]
                    if (token[0] === '@') return element.getAttribute(token.slice(1))
                    if (token === '_') return ElementHTML.getValue(element)
                    if ((token[0] === '`') && token.endsWith('`')) return token.slice(1, -1)
                    return element ? element.dataset[token] : token
                }
            },
            resolveMeta: {
                enumerable: true, value: function (element, is, name) {
                    let metaElement
                    const rootNode = element.shadowRoot || element.getRootNode()
                    return name ? rootNode.querySelector(`meta[is="${is}"][name="${name}"]`) : rootNode.querySelector(`meta[is="${is}"]`)
                }
            },
            resolveScope: {
                enumerable: true, value: function (scopeStatement, element, flags = []) {
                    if (!scopeStatement) return element.parentElement
                    let scope
                    if (flags.includes(scopeStatement[0])) {
                        scope = element
                    } else if ((scopeStatement === ':') || scopeStatement === ':root') {
                        scope = element.getRootNode()
                    } else if (scopeStatement === ':host') {
                        scope = element.getRootNode()
                        if (scope instanceof ShadowRoot) scope = scope.host
                    } else if (scopeStatement === ':document') {
                        scope = document
                    } else { scope = element.closest(scopeStatement) }
                    return scope
                }
            },
            resolveSelector: {
                enumerable: true, value: function (scope, selector, element) {
                    let selected
                    if (!selector) {
                        selected = scope
                        //} else if (selector === '$') {
                        //  selected = element
                    } else if (selector.includes('{') && selector.endsWith('}')) {
                        let [selectorStem, sig] = selector.split('{')
                        selected = this.sliceAndStep(sig.slice(0, -1), Array.from(scope.querySelectorAll(selectorStem)))
                    } else { selected = scope.querySelector(selector) }
                    return selected
                }
            },
            safeGet: {
                enumerable: true, value: function (element, privateValue, attrName, propName) {
                    propName ||= attrName
                    const attr = element.getAttribute(attrName)
                    if (privateValue !== attr) {
                        element[propName] = attr
                        return attr
                    } else { return privateValue }
                }
            },
            sliceAndStep: {
                enumerable: true, value: function (sig, list) {
                    let [start = 0, end = list.length, step = 0] = sig.split(':').map(s => (parseInt(s) || 0))
                    if (end === 0) end = list.length
                    list = list.slice(start, end)
                    if (!step) return list
                    return (step === 1) ? list.filter((v, i) => (i + 1) % 2) : list.filter((v, i) => (i + 1) % step === 0)
                }
            },
            splitOnce: {
                enumerable: true, value: function (str, delimiter) {
                    let r
                    str.split(delimiter).some((e, i, a) => r = a.length <= 2 ? (a) : [a[0], a.slice(1).join(delimiter)])
                    return r
                }
            },
            wait: {
                enumerable: true, value: async function (ms) {
                    return new Promise((resolve) => setTimeout(resolve, ms))
                }
            },
            waitUntil: {
                enumerable: true, value: async function (cb, ms = 100, max = 100) {
                    let count = 0
                    while ((count <= max) && !cb()) { await ElementHTML.utils.wait(ms); count = count + 1 }
                }
            }
        })
    },

    load: {
        enumerable: true, value: async function (rootElement = undefined) {
            if (!rootElement) {
                if (this._globalLoadCalled) return
                Object.defineProperty(this, '_globalLoadCalled', { enumerable: false, value: true })
                Object.defineProperty(this.env, 'ElementHTML', { enumerable: true, value: this })
                Object.freeze(this.env.options.security)
                Object.freeze(this.env.proxies)
                Object.freeze(this.env.gateways)
                const newModes = {}
                for (const [mode, signature] of Object.entries(this.env.modes)) {
                    let [path, pointer, ...suffix] = signature.split('/').map(s => s.split('.')).flat()
                    suffix = suffix.join('.')
                    Object.defineProperty(newModes, mode, {
                        enumerable: true, value: Object.defineProperties({}, {
                            path: { enumerable: true, value: path },
                            pointer: { enumerable: true, value: pointer }, suffix: { enumerable: true, value: suffix }
                        })
                    })
                }
                Object.defineProperty(this.env, 'modes', { enumerable: true, value: newModes })
                this.encapsulateNative()
            }
            rootElement && await this.activateTag(this.utils.getCustomTag(rootElement), rootElement)
            if (rootElement && !rootElement.shadowRoot) return
            const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
                observerRoot = rootElement || this
            for (const element of domTraverser.call(domRoot, '*')) if (this.utils.getCustomTag(element)) await this.load(element)
            const parseHeadMeta = (addedNode) => {
                const addedNodeMatches = addedNode.matches('title') ? 'title' : (addedNode.matches('meta[content][name]') ? 'meta' : false)
                let property, value
                if (addedNodeMatches === 'title') [property, value] = ['title', addedNode.textContent]
                if (addedNodeMatches === 'meta') [property, value] = [addedNode.getAttribute('name'), addedNode.getAttribute('content')]
                if (!addedNodeMatches) return
                let oldValue = this.env.eDataset[property]
                this.env.eDataset[property] = value
                this._dispatchPropertyEvent(this.env.eDataset, 'change', property, {
                    property: property, value: value, oldValue: oldValue, sanitizedValue: value,
                    validatedValue: value, sanitizerDetails: undefined, validatorDetails: undefined
                })
            }
            observerRoot._observer ||= new MutationObserver(async records => {
                for (const record of records) for (const addedNode of (record.addedNodes || [])) {
                    if (this.utils.getCustomTag(addedNode)) await this.load(addedNode)
                    if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.utils.getCustomTag(n)) await this.load(n)
                    if (addedNode.parentElement === document.head) parseHeadMeta(addedNode)
                }
            })
            observerRoot._observer.observe(domRoot, { subtree: true, childList: true })
            if (!rootElement) for (const metaElement of document.head.children) parseHeadMeta(metaElement)
        }
    },

    Errors: {
        enumerable: true, value: function (mode = 'hide') {
            mode = ['throw', 'show', 'hide'].includes(mode) ? mode : 'hide'
            this.env.options.errors = mode
        }
    },
    Expose: {
        enumerable: true, value: function (globalName = 'E') {
            if (!globalName) globalName = 'E'
            if (globalName && !window[globalName]) window[globalName] = this
        }
    },
    ImportPackage: {
        enumerable: true, value: function (p, a) {
            const areas = ['eDataset', 'modes', 'proxies', 'gateways', 'options', 'variables']
            for (const a in areas) {
                if (!area || (area === a)) {
                    const resultArea = area ? p : p[a]
                    if (resultArea instanceof Object) this.env[a] = { ...this.env[a], ...resultArea }
                }
            }
        }
    },

    _: {
        enumerable: true, value: function (element, value, silent) {
            return (value === undefined) ? this.getValue(element) : this.setValue(element, value, undefined, silent)
        }
    },
    $: {
        enumerable: true, value: async function (element, data, flag, transform, silent) {
            return await this.sinkData(element, data, flag, transform, undefined, undefined, undefined, undefined, silent)
        }
    },

    getValue: {
        enumerable: true, value: function (element, useDataset = 'auto') {
            if (!(element instanceof HTMLElement)) return
            const preGetValue = (this.env.map.get(element) ?? {})['preGetValue']
            if (preGetValue) element = typeof preGetValue === 'function' ? preGetValue(element, useDataset) : preGetValue
            const ret = (v) => {
                const postGetValue = (this.env.map.get(element) ?? {})['postGetValue']
                if (postGetValue) v = typeof postGetValue === 'function' ? postGetValue(v, element, useDataset) : postGetValue
                return v
            }
            if ('value' in element) {
                return element.value
            } else if (element.hasAttribute('itemscope')) {
                const value = {}, parseElementForValues = (el) => {
                    if (!el) return
                    const scopeTo = el.hasAttribute('id') ? 'id' : 'itemscope'
                    for (const propElement of el.querySelectorAll('[itemprop]')) if (propElement.parentElement.closest(`[${scopeTo}]`) === el) {
                        const propName = propElement.getAttribute('itemprop'), propValue = this.getValue(propElement)
                        if (Object.keys(value).includes(propName)) {
                            if (!Array.isArray(value[propName])) value[propName] = [value[propName]]
                            value[propName].push(propValue)
                        } else { value[propName] = propValue }
                    }
                }
                if (element.hasAttribute('itemref')) {
                    const rootNode = element.getRootNode()
                    for (const ref of element.getAttribute('itemref').split(' ')) parseElementForValues(rootNode.getElementById(ref))
                } else { parseElementForValues(element) }
            } else if (element.eDataset) {
                const valueProxy = element._ || element.__
                if (valueProxy) return element.eDataset[valueProxy]
                const retval = Object.assign({}, element.eDataset)
                for (const k of Object.keys(retval)) if (k.includes('__')) {
                    const unsafeProperty = k.replaceAll('__', '-')
                    retval[unsafeProperty] = retval[k]
                    delete retval[k]
                }
                return ret(retval)
            } else {
                if (useDataset === 'auto') useDataset = !!Object.keys(element.dataset).length
                if (useDataset) return ret({ ...element.dataset })
                const tag = (element.getAttribute('is') || element.tagName).toLowerCase()
                if (tag === 'meta') return ret(element.getAttribute('content'))
                if (['audio', 'embed', 'iframe', 'img', 'source', 'track', 'video'].includes(tag)) return ret(new URL(element.getAttribute('src'), element.getRootNode().baseURI).href)
                if (['a', 'area', 'link'].includes(tag)) return ret(new URL(element.getAttribute('href'), element.getRootNode().baseURI).href)
                if (tag === 'object') return ret(new URL(element.getAttribute('data'), element.getRootNode().baseURI).href)
                if (['data', 'meter', 'input', 'select', 'textarea'].includes(tag)) return ret(element.value)
                if (tag === 'time') return ret(element.getAttribute('datetime'))
                if (['form', 'fieldset'].includes(tag)) return ret(Object.fromEntries(Array.from(element.querySelectorAll('[name]')).map(f => [f.getAttribute('name'), this.getValue(f)])))
                return ret(element.textContent)
            }
        }
    },
    setValue: {
        enumerable: true, value: function (element, value, scopeNode, silent = undefined) {
            if (!(element instanceof HTMLElement)) return
            const preSetValue = (this.env.map.get(element) ?? {})['preSetValue']
            if (preSetValue) value = typeof preSetValue === 'function' ? preSetValue(value, element, scopeNode) : preSetValue
            const close = () => {
                const postSetValue = (this.env.map.get(element) ?? {})['postSetValue']
                if (postSetValue) element = typeof postSetValue === 'function' ? postSetValue(element, value, scopeNode) : postSetValue
                if (!silent) element.dispatchEvent(new CustomEvent('change', { detail: { value, scopeNode } }))
                return element
            }, tag = (element.getAttribute('is') || element.tagName).toLowerCase()
            if (('value' in element) && !(value instanceof Object)) {
                element.value = value
            } else if (value instanceof Object) {
                if (element.hasAttribute('itemscope')) {
                    for (const [propName, propValue] of Object.entries(value)) {
                        let propElement
                        if (element.hasAttribute('itemref')) {
                            const rootNode = element.getRootNode()
                            for (const ref of element.getAttribute('itemref').split(' ')) if (propElement ||= rootNode.getElementById(ref)?.querySelector(`[itemprop="${propName}"]`)) break
                        } else { propElement = element.querySelector(`[itemprop="${propName}"]`) }
                        if (propElement) this.setValue(propElement, propValue)
                    }
                } else if (Array.isArray(value) && element.hasAttribute('itemprop')) {
                    const elementProp = element.getAttribute('itemprop')
                    scopeNode ||= element.parentElement.closest('[itemscope]')
                    if (!scopeNode) return
                    const propSiblings = Array.from(scopeNode.querySelectorAll(`[itemprop="${elementProp}"]`)),
                        propTemplate = propSiblings[0].cloneNode(true), propTemplateDisplay = propTemplate.style.getPropertyValue('display')
                    for (const [i, v] in Array.entries(value)) {
                        if (i in propSiblings && (this.setValue(propSiblings[i], v) || true)) continue
                        const newSibling = propTemplate.cloneNode(true)
                        newSibling.style.setProperty('display', none)
                        propSiblings[propSiblings.length - 1].after(newSibling)
                        this.setValue(newSibling, v)
                        propTemplateDisplay ? newSibling.style.setProperty('display', propTemplateDisplay) : newSibling.style.removeProperty('display')
                        propSiblings[i] = newSibling
                    }
                    for (const propSibling of propSiblings.slice(value.length)) propSibling.remove()
                } else if (['form', 'fieldset'].includes(tag)) {
                    for (const [k, v] of Object.entries(value)) {
                        const f = element.querySelector(`[name="${k}"]`)
                        if (f) this.setValue(f, v)
                    }
                } else {
                    Object.assign((element.eDataset || element.dataset), value)
                }
            } else {
                if (element.eDataset instanceof Object && element._) {
                    element.eDataset[element._] = value
                    if (value === undefined) delete element.eDataset[element._]
                } else {
                    const attrMethod = value === undefined ? 'removeAttribute' : 'setAttribute'
                    if (tag === 'meta') { element[attrMethod]('content', value); return close() }
                    if (['audio', 'embed', 'iframe', 'img', 'source', 'track', 'video'].includes(tag)) { element[attrMethod]('src', value); return close() }
                    if (['a', 'area', 'link'].includes(tag)) { element[attrMethod]('href', value); return close() }
                    if (tag === 'object') { element[attrMethod]('data', value); return close() }
                    if (['data', 'meter', 'input', 'select', 'textarea'].includes(tag)) { element.value = (value ?? ''); return close() }
                    if (tag === 'time') { element[attrMethod]('datetime', value); return close() }
                    element.textContent = value
                }
            }
            return close()
        }
    },
    sinkData: {
        enumerable: true, value: async function (element, data, flag, transform, sourceElement, context = {}, layer = 0, rootElement = undefined, silent = undefined) {
            if (!(element instanceof HTMLElement)) return
            const preSinkData = (this.env.map.get(element) ?? {})['preSinkData']
            if (typeof preSinkData === 'function') ({ element=element, data=data, flag=flag, transform=transform, sourceElement=sourceElement, context=content, layer=layer, rootElement=rootElement } = await preSinkData(element, data, flag, transform, sourceElement, context, layer, rootElement))
            if (preSinkData instanceof Object) ({ element=element, data=data, flag=flag, transform=transform, sourceElement=sourceElement, context=content, layer=layer, rootElement=rootElement } = preSinkData)
            const close = async (element) => {
                const postSinkData = (this.env.map.get(element) ?? {})['postSinkData']
                if (typeof postSinkData === 'function') element = await postSinkData(element, data, flag, transform, sourceElement, context, layer, rootElement)
                if (postSinkData instanceof Object) element = postSinkData
                if (!silent) element.dispatchEvent(new CustomEvent('sinkData', { detail: { data, flag, transform, sourceElement, context, layer, rootElement } }))
                return element
            }
            rootElement ||= element
            if (transform) {
                if (!this.env.libraries.jsonata && !document.querySelector('script[src="https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js"]')) {
                    const scriptTag = document.createElement('script')
                    scriptTag.setAttribute('src', 'https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js')
                    document.head.append(scriptTag)
                    await this.utils.waitUntil(() => window.jsonata)
                    this.env.libraries.jsonata = window.jsonata
                }
                await this.utils.waitUntil(() => this.env.libraries.jsonata)
                if ((transform[0] === '$') && !transform.startsWith('$.') && !transform.slice(1).includes('$') && !transform.includes('{') && !transform.includes(':')) {
                    const variableValue = this.getVariable(transform, element)
                    if (typeof variableValue === 'string') transform = variableValue
                }
                const variables = []
                if (transform.includes('$env')) variables.push(`$env := ${JSON.stringify(this.env, ['eDataset', 'modes', 'options', 'variables'])}`)
                if (transform.includes('$sourceElement')) variables.push(`$sourceElement := ${JSON.stringify(sourceElement ? sourceElement.valueOf() : {})}`)
                if (transform.includes('$target')) variables.push(`$target := ${JSON.stringify(this.getValue(element))}`)
                if (transform.includes('$flag')) variables.push(`$flag := ${JSON.stringify(flag ?? '')}`)
                if (transform.includes('$context')) variables.push(`$context := ${JSON.stringify(context ?? '')}`)
                for (const [vn, vv] of Object.entries(this.env.variables)) {
                    if ((vn === 'env') || (vn === 'sourceElement') || (vn === 'target') || (vn === 'flag') || (vn === 'context')) continue
                    if (transform.includes(`$${vn}`)) variables.push(`$${vn} := ${JSON.stringify(vv)}`)
                }
                if (variables.length) transform = `( ${variables.join(' ; ')} ; ${transform})`
                data = await this.env.libraries.jsonata(transform).evaluate(data)
            }
            if (data instanceof HTMLElement) data = this.flatten(data)
            const dataIsObject = (data instanceof Object)
            if (dataIsObject && !Object.keys(data).length) return element
            flag ||= sourceElement?.flag
            if (element === document.head || element === document || (element === sourceElement && sourceElement?.parentElement === document.head)) {
                const useNode = element === document.head ? element : document
                for (const [k, v] of Object.entries(data)) {
                    if (k === 'title' || k === '@title' || k === '.title') {
                        useNode.querySelector('title').textContent = v
                    } else {
                        const metaElements = useNode.children,
                            metaElement = (k.startsWith('@') || k.startsWith('.')) ? metaElements[k.slice(1)] : metaElements[k]
                        metaElement && metaElement.setAttribute('content', v)
                    }
                }
                return await close(element)
            }
            const tag = element.tagName.toLowerCase()
            if (dataIsObject && flag === '@') {
                for (const [k, v] of Object.entries(data)) (v === null || v === undefined) ? element.removeAttribute(k) : element.setAttribute(k, v)
            } else if (dataIsObject && flag === '.') {
                for (const [k, v] of Object.entries(data)) (v === null || v === undefined) ? delete element[k] : element[k] = v
            } else if (dataIsObject && flag === 'dataset') {
                for (const [k, v] of Object.entries(data)) element.dataset[k] = v
            } else if (dataIsObject && flag === 'eDataset' && element.eDataset instanceof Object) {
                Object.assign(element.eDataset, data)
            } else if (dataIsObject && flag === 'eContext' && element.eContext instanceof Object) {
                Object.assign(element.eContext, data)
            } else if (flag && ((data ?? {}) instanceof Object) && (flag.endsWith('{}') || flag.endsWith('{...}') || flag.endsWith('{,...}') || flag.endsWith('{...,}'))) {
                const [sinkPropertyName, sinkFlag] = flag.split('{')
                if (sinkFlag === '...,}') {
                    element[sinkPropertyName] = (sinkPropertyName && ((element[sinkPropertyName] ?? {}) instanceof Object)) ? Object.assign((data ?? {}), (element[sinkPropertyName] ?? {})) : element[sinkPropertyName]
                } else {
                    if (sinkPropertyName) element[sinkPropertyName] ||= {}
                    if (sinkPropertyName) {
                        element[sinkPropertyName] = ((element[sinkPropertyName] ?? {}) instanceof Object) ? Object.assign(element[sinkPropertyName], (data ?? {})) : element[sinkPropertyName]
                    } else { Object.assign(element, (data ?? {})) }
                }
            } else if (flag && (flag.endsWith('()') || flag.includes('(,') || flag.includes(',)') || flag.endsWith('(...)') || flag.includes('(...,') || flag.includes(',...)'))) {
                const [sinkFunctionName, sinkFlag] = flag.split('(')
                if (typeof element[sinkFunctionName] !== 'function') return
                if (sinkFlag.includes('...') && Array.isArray(data)) {
                    if (sinkFlag === '...)') {
                        element[sinkFunctionName](...data)
                    } else if (sinkFlag.includes('...,')) {
                        element[sinkFunctionName](...data, ...sinkFlag.split(',').slice(1).map(a => this.getVariable(a, element)))
                    } else if (sinkFlag.includes(',...')) {
                        element[sinkFunctionName](...sinkFlag.split(',').slice(1).map(a => this.getVariable(a, element)), ...data)
                    } else { return }
                } else if (sinkFlag === ')') {
                    element[sinkFunctionName](data)
                } else if (sinkFlag.startsWith(',')) {
                    element[sinkFunctionName](data, ...sinkFlag.slice(1).split(',').map(a => this.getVariable(a, element)))
                } else if (sinkFlag.endsWith(',)')) {
                    element[sinkFunctionName](...sinkFlag.slice(0, -2).split(',').map(a => this.getVariable(a, element)), data)
                } else { return }
            } else if (flag && ((flag.startsWith('...')) || (typeof element[flag] === 'function') || flag.includes('('))) {
                if (flag.startsWith('...')) {
                    const sinkFunctionName = flag.slice(3)
                    if (typeof element[sinkFunctionName] === 'function' && dataIsObject && Array.isArray(data)) {
                        element[sinkFunctionName](...data)
                    } else if (dataIsObject && !element[sinkFunctionName] || (element[sinkFunctionName] instanceof Object)) {
                        element[sinkFunctionName] = { ...(element[sinkFunctionName] ?? {}), ...data }
                    }
                } else { element[flag](data) }
            } else if (flag) {
                element[flag] = data
            } else if (dataIsObject && element.querySelector(':scope > template')) {
                let after = document.createElement('meta')
                after.toggleAttribute('after', true)
                element.querySelector(`:scope > template:last-of-type`).after(after)
                while (after.nextElementSibling) after.nextElementSibling.remove()
                const filterTemplates = (templates, value, data) => {
                    if (!templates.length) return
                    const matchingTemplates = [], ops = {
                        '=': (c, v) => v == c, '!': (c, v) => v != c, '<': (c, v) => v < c, '>': (c, v) => v > c, '%': (c, v) => !!(v % c),
                        '~': (c, v) => !(v % c), '^': (c, v) => `${v}`.startsWith(c), '$': (c, v) => `${v}`.endsWith(c),
                        '*': (c, v) => `${v}`.includes(c), '-': (c, v) => !`${v}`.includes(c),
                        '+': (c, v) => `${v}`.split(' ').includes(c), '_': (c, v) => !`${v}`.split(' ').includes(c),
                        '/': (c, v) => (new RegExp(...this.utils.splitOnce(c.split('').reverse().join(''), '/').map(s => s.s.split("").reverse().join("")))).test(`${v}`)
                    }
                    for (const et of templates) {
                        const ifLayer = et.getAttribute('data-e-if-layer')
                        if (ifLayer) {
                            const separator = ifLayer.includes('||') ? '||' : '&&', results = []
                            for (const cond of ifLayer.split(separator).map(s => s.trim())) {
                                if (cond[0] in ops) {
                                    results.push(ops[cond[0]](cond.slice(1), layer))
                                } else { results.push(ops['='](cond, layer)) }
                            }
                            if (!((separator == '||') ? results.includes(true) : !results.includes(false))) continue
                        }
                        const ifContext = et.getAttributeNames().filter(an => an.startsWith('data-e-if-context-')).map(an => [an.replace('data-e-if-context-', ''), el.getAttribute(an)])
                        if (ifContext.length) for (const [ck, cond] of ifContext) {
                            if (typeof context[ck] === 'function') if (!context[ck](cond, ck, layer, context, el.cloneNode(true))) continue
                            const separator = ifContext.includes('||') ? '||' : '&&', results = []
                            for (const cond of ifContext.split(separator).map(s => s.trim())) if (cond[0] in ops) results.push((ops[cond[0]] ?? ops['='])(cond.slice(1), context[ck]))
                            if (!((separator == '||') ? results.includes(true) : !result.includes(false))) continue
                        }
                        const ifType = et.getAttribute('data-e-if-type')
                        if (ifType && !((value?.constructor?.name?.toLowerCase() === ifType.toLowerCase())
                            || ((ifType === 'object') && (value instanceof Object)) || ((ifType === 'scalar') && !(value instanceof Object)))) continue
                        const ifParent = et.getAttribute('data-e-if-parent')
                        if (ifParent && !((data?.constructor?.name?.toLowerCase() === ifParent.toLowerCase()))) continue
                        return et
                    }
                    return
                }, build = (template, key, value) => {
                    const newTemplate = document.createElement('template')
                    newTemplate.content.replaceChildren(...template.content.cloneNode(true).children)
                    const runMerge = (eMerge, use) => {
                        for (const [k, v] of Object.entries(eMerge)) {
                            if (v === '.') {
                                use = use.replaceAll(k, `${key ?? ''}`)
                            } else if (v === '$') {
                                use = use.replaceAll(k, `${value ?? ''}`)
                            } else { use = use.replaceAll(k, `${data[v] ?? ''}`) }
                        }
                        return use.trim()
                    }
                    for (const useTemplate of newTemplate.content.querySelectorAll('template[data-e-use]')) {
                        const fragmentsToUse = []
                        for (let use of (useTemplate.getAttribute('data-e-use') || '').split(';')) {
                            if (use.startsWith('`') && use.endsWith('`')) {
                                const htmlFragment = document.createElement('div')
                                if (useTemplate.dataset.eMerge) {
                                    const eMerge = (this.utils.parseObjectAttribute(useTemplate.dataset.eMerge, element) || {})
                                    use = runMerge(eMerge, use.slice(1, -1))
                                }
                                /* need to support setHTML, using white-listed custom elements and attribute etc */
                                // typeof htmlFragment.setHTML === 'function' ? htmlFragment.setHTML(use) : (htmlFragment.innerHTML = use)
                                htmlFragment.innerHTML = use
                                for (const element of htmlFragment.querySelectorAll('*')) {
                                    const tag = element.tagName.toLowerCase()
                                    if (tag === 'script' && !this.env.options.security.allowTemplateUseScripts) element.remove()
                                    if (tag.includes('-') && !tag.startsWith('e-') && !this.env.options.security.allowTemplateUseCustom.includes(tag)) element.remove()
                                }
                                fragmentsToUse.push(...Array.from(htmlFragment.children).map(c => c.cloneNode(true)))
                            } else {
                                const [scopeStatement, selector = "template[data-e-fragment]"] = this.utils.splitOnce(use, '|').map(s => s.trim()),
                                    fragmentToUse = (this.utils.resolveScope(scopeStatement, element) || element).querySelector(selector)
                                if (fragmentToUse) {
                                    const fragmentChildren = fragmentToUse.tagName.toLowerCase() === 'template' ? fragmentToUse.content.children : fragmentToUse.children
                                    fragmentsToUse.push(...Array.from(fragmentChildren).map(c => c.cloneNode(true)).map(n => {
                                        let eMerge = (this.utils.parseObjectAttribute(useTemplate.dataset.eMerge, element) || {}), use = n.innerHTML
                                        use = runMerge(eMerge, use)
                                        // typeof n.setHTML === 'function' ? n.setHTML(use) : (n.innerHTML = use)
                                        n.innerHTML = use
                                        return n
                                    }))
                                }
                            }
                        }
                        useTemplate.replaceWith(...fragmentsToUse.map(n => n.cloneNode(true)))
                    }
                    return newTemplate
                }, querySuffix = ':not([data-e-fragment]):not([data-e-use])'
                const entries = Array.isArray(data) ? data.entries() : Object.entries(data)
                for (const [key, value] of entries) {
                    let entryTemplate = filterTemplates(element.querySelectorAll(`:scope > template[data-e-property="${key}"]:not([data-e-key])${querySuffix}`), value, data)
                        || filterTemplates(element.querySelectorAll(`:scope > template:not([data-e-property]):not([data-e-key])${querySuffix}`), value, data)
                    if (entryTemplate) {
                        const recursiveTemplates = element.querySelectorAll(':scope > template[data-e-place-into]'),
                            entryNode = build(entryTemplate, key, value).content.cloneNode(true), keyTemplate = filterTemplates(entryNode.querySelectorAll(`template[data-e-key]${querySuffix}`), value, data)
                        let valueTemplates = entryNode.querySelectorAll(`template[data-e-value]${querySuffix}`)
                        if (keyTemplate) keyTemplate.replaceWith(this.setValue(build(keyTemplate, key, value).content.cloneNode(true).children[0] || '', key, undefined, silent))
                        if (!valueTemplates.length) valueTemplates = entryNode.querySelectorAll(`template:not([data-e-key])${querySuffix}`)
                        if (valueTemplates.length) {
                            let valueTemplate = valueTemplates[valueTemplates.length - 1]
                            for (const t of valueTemplates) {
                                if (t.getAttribute('data-e-fragment') || t.getAttribute('data-e-use')) continue
                                const templateDataType = t.getAttribute('data-e-if-type')
                                if ((value?.constructor?.name?.toLowerCase() === templateDataType) || ((templateDataType === 'object') && (value instanceof Object))
                                    || ((templateDataType === 'scalar') && !(value instanceof Object))) { valueTemplate = t; break }
                            }
                            const valueNode = build(valueTemplate, key, value).content.cloneNode(true)
                            for (const recursiveTemplate of recursiveTemplates) {
                                let placed = false
                                for (const scopedTarget of valueNode.querySelectorAll(recursiveTemplate.getAttribute('data-e-place-into'))) {
                                    scopedTarget.prepend(recursiveTemplate.cloneNode(true))
                                    placed = true
                                }
                                if (!placed && (value instanceof Object)) valueNode.prepend(recursiveTemplate.cloneNode(true))
                            }
                            this.sinkData(valueNode.children[0], value, flag, transform, sourceElement, context, layer + 1, element)
                            valueTemplate.replaceWith(...valueNode.children)
                        }
                        if ((entryTemplate.dataset.eSink === 'true') || (!keyTemplate && !valueTemplates.length && (entryTemplate.dataset.eSink !== 'false'))) this.sinkData(entryNode.children[0], value, flag, transform, sourceElement, context, layer + 1, element)
                        if (entryTemplate.getAttribute('data-e-property')) {
                            entryTemplate.after(...entryNode.children)
                        } else {
                            const nextAfter = entryNode.children[entryNode.children.length - 1]
                            after?.after(...entryNode.children)
                            if (nextAfter) after = nextAfter
                        }
                    }
                }
                element.querySelector('meta[after]')?.remove()
            } else if (['input', 'select', 'datalist'].includes(tag) && Array.isArray(data)) {
                const optionElements = []
                for (const d of data) {
                    const optionElement = document.createElement('option')
                    this.setValue(optionElement, d, element, true)
                    optionElements.push(optionElement)
                }
                if (tag === 'select' || tag === 'datalist') {
                    element.replaceChildren(...optionElements)
                } else if (tag === 'input' && sourceElement) {
                    const datalist = sourceElement.dataset.datalistId
                        ? document.getElementById(sourceElement.dataset.datalistId) : document.createElement('datalist')
                    datalist.replaceChildren(...optionElements)
                    if (!sourceElement.dataset.datalistId) {
                        sourceElement.dataset.datalistId = crypto.randomUUID()
                        datalist.setAttribute('id', sourceElement.dataset.datalistId)
                        document.body.append(datalist)
                        element.setAttribute('list', sourceElement.dataset.datalistId)
                    }
                }
            } else if (dataIsObject && ['form', 'fieldset'].includes(tag)) {
                for (const [k, v] of Object.entries(data)) this.sinkData((element.querySelector(`[name=${k}]`) || {}), v)
            } else if (dataIsObject && ['table', 'tbody'].includes(tag)) {
                let tbody = tag === 'tbody' ? element : element.querySelector('tbody')
                if (!tbody) element.append(tbody = document.createElement('tbody'))
                let rowsData = ((Array.isArray(data) && data.every(r => Array.isArray(r))) || (data instanceof Object && Object.values(data).every(r => Array.isArray(r)))) ? data : undefined
                if (rowsData) {
                    if (tag === 'table') {
                        const headers = rowsData.shift()
                        let thead = element.querySelector('thead')
                        if (!thead) element.prepend(thead = document.createElement('thead'))
                        let thRow = thead.querySelector('tr')
                        if (!thRow) thead.prepend(thRow = document.createElement('tr'))
                        for (const h of headers) thead.appendChild(document.createElement('th')).textContent = h
                    }
                    const namedRows = !Array.isArray(data)
                    for (const [k, v] of Object.entries(rowsData)) {
                        const tr = document.createElement('tr')
                        namedRows && tr.setAttribute('name', k)
                        for (const vv of v) tr.appendChild(document.createElement('td')).textContent = vv
                        tbody.append(tr)
                    }
                }
            } else if (['ul', 'ol'].includes(tag)) {
                if (!Array.isArray(data)) data = [data]
                element.replaceChildren()
                for (const item of data) {
                    const li = document.createElement('li')
                    li.innerHTML = item
                    element.append(li)
                }
            } else if (dataIsObject && (tag === 'dl') && (data instanceof Object)) {
                element.replaceChildren()
                for (const [t, d] of Object.entries(data)) {
                    const dt = document.createElement('dt')
                    dt.innerHTML = t
                    element.append(dt)
                    const dd = document.createElement('dd')
                    dd.innerHTML = d
                    element.append(dd)
                }
            } else if (!dataIsObject) {
                this.setValue(element, data, undefined, silent)
            } else {
                if (dataIsObject && element.eDataset instanceof Object) {
                    Object.assign(element.eDataset, data)
                } else {
                    const sinkDataAuto = (k, v, flag, element, sourceElement, context, layer, silent) => {
                        let key = k.trim(), target = element
                        if (key.startsWith('`')) {
                            let [qs, kk] = this.utils.splitOnce(key.slice(1), '`').map(s => s.trim())
                            key = kk
                            if (!qs) return
                            target = target.querySelector(qs)
                            if (!target) return
                            if (key && key.startsWith('@')) {
                                (v === null || v === undefined) ? target.removeAttribute(k.slice(1)) : target.setAttribute(key.slice(1), v)
                            } else if (key && key.startsWith('.')) {
                                (v === null || v === undefined) ? delete target[k.slice(1)] : target[key.slice(1)] = v
                            } else if (key) {
                                if (v === null) {
                                    delete target.dataset[key]
                                } else { target.dataset[key] = v }
                            } else if (target === element) {
                                this.setValue(target, v, undefined, silent)
                            } else {
                                this.sinkData(target, v, undefined, undefined, sourceElement, context, layer, element, silent)
                            }
                            return
                        }
                        if (key.startsWith('@')) {
                            (v === null || v === undefined) ? target.removeAttribute(k.slice(1)) : target.setAttribute(key.slice(1), v)
                        } else if (key.startsWith('.')) {
                            (v === null || v === undefined) ? delete target[k.slice(1)] : target[key.slice(1)] = v
                        } else if (key) {
                            if (v === null) {
                                delete target.dataset[key]
                            } else { target.dataset[key] = v }
                        } else { this.setValue(target, v, undefined, silent) }
                    }
                    for (const [k, v] of Object.entries(data)) sinkDataAuto(k, v, flag, element, sourceElement, context, layer, silent)
                }
            }
            return await close(element)
        }
    },

    parse: {
        enumerable: true, value: async function (input, sourceElement, contentType) {
            const typeCheck = (input instanceof Response) || (typeof input === 'text')
            if (!typeCheck && (input instanceof Object)) return input
            input = typeCheck ? input : `${input}`
            if (!contentType) {
                contentType = sourceElement.getAttribute('content-type') || (sourceElement.optionsMap ?? {})['Content-Type'] || sourceElement._contentType || undefined
                if (!contentType && (input instanceof Response)) {
                    contentType ||= input.url.endsWith('.html') ? 'text/html' : undefined
                    contentType ||= input.url.endsWith('.css') ? 'text/css' : undefined
                    contentType ||= input.url.endsWith('.md') ? 'text/md' : undefined
                    contentType ||= input.url.endsWith('.csv') ? 'text/csv' : undefined
                    contentType ||= input.url.endsWith('.txt') ? 'text/plain' : undefined
                    contentType ||= input.url.endsWith('.json') ? 'application/json' : undefined
                    contentType ||= input.url.endsWith('.yaml') ? 'application/x-yaml' : undefined
                    contentType ||= input.url.endsWith('.hjson') ? 'application/hjson' : undefined
                    const serverContentType = input.headers.get('Content-Type')
                    if (serverContentType !== 'application/octet-stream') contentType ||= serverContentType || undefined
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
            if (contentType === 'application/json') return (input instanceof Response) ? await input.json() : JSON.parse(input)
            let text = ((input instanceof Response) ? await input.text() : response).trim()
            if (contentType === 'text/md') {
                await this.installLibraryFromImport('remarkable', 'Remarkable', true)
                let mdOptions = { ...this.env.options.remarkable }
                if (sourceElement.hasAttribute('md')) mdOptions = { ...mdOptions, ...Object.fromEntries((this.utils.parseObjectAttribute(sourceElement.getAttribute('md'), sourceElement) || {}).entries()) }
                this.env.libraries.remarkable.set(mdOptions)
                const htmlBlocks = (text.match(new RegExp('<html>\\n+.*\\n+</html>', 'g')) ?? []).map(b => [crypto.randomUUID(), b]),
                    htmlSpans = (text.match(new RegExp('<html>.*</html>', 'g')) ?? []).map(b => [crypto.randomUUID(), b])
                for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
                for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
                text = this.env.libraries.remarkable.render(text)
                for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
                for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
                return text
            }
            if (contentType && contentType.includes('form')) {
                return Object.fromEntries((new URLSearchParams(text)).entries())
            }
            if (contentType === 'text/css') {
                return await (new CSSStyleSheet()).replace(text)
            }
            if (contentType === 'application/hjson') {
                this.env.libraries.hjson ||= await import('https://cdn.jsdelivr.net/npm/hjson@3.2.2/+esm')
                return this.env.libraries.hjson.parse(text)
            }
            if (contentType.includes('yaml')) {
                this.env.libraries.yaml ||= await import('https://cdn.jsdelivr.net/npm/yaml@2.3.2/+esm')
                return this.env.libraries.yaml.parse(text)
            }
            if (contentType === 'text/csv') {
                this.env.libraries.papaparse ||= (await import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm')).default
                return this.env.libraries.papaparse.parse(text, { dynamicTyping: true }).data
            }
            return text
        }
    },
    serialize: {
        enumerable: true, value: async function (input, sourceElement, contentType) {
            if (typeof input === 'string') return input
            contentType ||= sourceElement.getAttribute('content-type') || sourceElement.optionsMap['Content-Type'] || sourceElement._contentType || 'application/json'
            if (!contentType.includes('/')) contentType = `application/${contentType}`
            if (contentType === 'application/json') return JSON.stringify(input)
            if (contentType === 'text/html' || contentType === 'text/md') {
                if (!(input instanceof Node)) return
                let text = input?.outerHTML ?? input.textContent
                if (contentType === 'text/md') {
                    await this.installLibraryFromImport('remarkable', 'Remarkable', true)
                    let mdOptions = { ...this.env.options.remarkable }
                    if (sourceElement.hasAttribute('md')) mdOptions = { ...mdOptions, ...Object.fromEntries((this.utils.parseObjectAttribute(sourceElement.getAttribute('md'), sourceElement) || {}).entries()) }
                    this.env.libraries.remarkable.set(mdOptions)
                    text = this.env.libraries.remarkable.render(text)
                }
                return text
            }
            if (contentType && contentType.includes('form')) {
                return (new URLSearchParams(input)).toString()
            }
            if (contentType === 'text/css') {
                if (input instanceof Node) return (await (new CSSStyleSheet()).replace(input.textContent)).cssRules.map(rule => rule.cssText).join('\n')
                if (input instanceof CSSStyleSheet) return input.cssRules.map(rule => rule.cssText).join('\n')
            }
            if (contentType === 'application/hjson') {
                this.env.libraries.hjson ||= await import('https://cdn.jsdelivr.net/npm/hjson@3.2.2/+esm')
                return this.env.libraries.hjson.stringify(input)
            }
            if (contentType && contentType.includes('yaml')) {
                this.env.libraries.yaml ||= await import('https://cdn.jsdelivr.net/npm/yaml@2.3.2/+esm')
                return this.env.libraries.yaml.stringify(input)
            }
            if (contentType === 'text/csv' || contentType === 'text/tsv') {
                this.env.libraries.papaparse ||= (await import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm')).default
                return this.env.libraries.papaparse.unparse(input)
            }
            return JSON.stringify(input)
        }
    },

    compileRequestOptions: {
        enumerable: true, value: async function (body, element, optionsMap, serializer, defaultContentType = 'application/json') {
            let requestOptions = optionsMap ?? element?.optionsMap ?? {}
            if (requestOptions.$ && typeof requestOptions.$ === 'string') {
                let variableValue = this.getVariable(requestOptions.$, element)
                if (variableValue && (variableValue instanceof Object)) requestOptions = { ...variableValue, ...requestOptions }
            }
            let headers = requestOptions.headers ?? {}, contentType = headers['Content-Type'] ?? headers['content-type'] ?? headers.contentType
            contentType ||= element.getAttribute('content-type') || element._contentType
            if (!contentType && body) contentType ||= defaultContentType
            if (contentType) {
                requestOptions.headers = headers
                requestOptions.headers['Content-Type'] = contentType
                delete requestOptions.headers['content-type']
                delete requestOptions.headers.contentType
            }
            if (body instanceof Object) {
                serializer ||= element?.serializer ?? this.serialize
                requestOptions.body = await serializer(body, element, contentType)
            } else if (body) {
                requestOptions.method ||= 'POST'
                requestOptions.body = `${body}`
            }
            return requestOptions
        }
    },
    expandTransform: {
        enumerable: true, value: async function (transform, element, variableMap = {}) {
            if (!transform) return
            if ((transform[0] === '$') && !transform.startsWith('$.') && !transform.slice(1).includes('$') && !transform.includes('{') && !transform.includes(':')) {
                const variableValue = this.getVariable(transform, element)
                if (typeof variableValue === 'string') transform = variableValue
            }
            try {
                const variables = []
                if (element && transform.includes('$this')) variables.push(`$this := ${JSON.stringify(element.valueOf())}`)
                if (transform.includes('$env')) variables.push(`$env := ${JSON.stringify(this.env, ['eDataset', 'modes', 'options'])}`)
                if (transform.includes('$sessionStorage') || transform.includes('$localStorage')) {
                    const storageType = transform.includes('$sessionStorage') ? 'sessionStorage' : 'localStorage',
                        entries = Object.entries(window[storageType]).map(ent => {
                            if (ent[1] && ent[1].startsWith('{') && ent[1].endsWith('}')) {
                                try { ent[1] = JSON.parse(ent[1]) } catch (e) { }
                            } else if (ent[1] && ent[1].startsWith('[') && ent[1].endsWith(']')) {
                                try { ent[1] = JSON.parse(ent[1]) } catch (e) { }
                            } else if (ent[1] && ent[1].startsWith('"') && ent[1].endsWith('"')) {
                                ent[1] = ent[1].slice(1, -1)
                            } else if (Number(ent[1])) {
                                ent[1] = Number(ent[1])
                            } else if (ent[1] === '0') {
                                ent[1] = 0
                            } else if ((ent[1] === 'null') || (ent[1] === 'undefined')) {
                                ent[1] = null
                            }
                            return ent
                        })
                    variables.push(`$${storageType} := ${JSON.stringify(Object.fromEntries(entries))}`)
                }
                for (const [variableName, variableValue] of Object.entries(variableMap)) {
                    if (transform.includes(`$${variableName}`)) variables.push(`$${variableName} := ${JSON.stringify(variableValue)}`)
                }
                for (const [vn, vv] of Object.entries(this.env.variables)) {
                    if ((vn === 'env') || (vn === 'this')) continue
                    if (transform.includes(`$${vn}`)) variables.push(`$${vn} := ${JSON.stringify(vv)}`)
                }
                if (variables.length) transform = `( ${variables.join(' ; ')} ; ${transform})`
            } catch (e) {
                if (!element) return
                element.dispatchEvent(new CustomEvent('error', { detail: { type: 'expandTransform', message: e, input: variableMap } }))
                if (element.errors === 'throw') { throw new Error(e); return } else if (element.errors === 'hide') { transform = transform }
            }
            return transform
        }
    },
    flatten: {
        enumerable: true, value: function (element) {
            const override = (this.env.map.get(element) ?? {})['eFlatten']
            if (override) return typeof override === 'function' ? override(element) : override
            return {
                ...Object.fromEntries(element.getAttributeNames().map(a => ([`@${a}`, element.getAttribute(a)]))),
                ...Object.fromEntries(['baseURI', 'checked', 'childElementCount', 'className',
                    'clientHeight', 'clientLeft', 'clientTop', 'clientWidth',
                    'id', 'innerHTML', 'innerText', 'lang', 'localName', 'namespaceURI',
                    'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'outerHTML', 'outerText', 'prefix',
                    'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop', 'scrollTopMax', 'scrollWidth',
                    'selected', 'slot', 'tagName', 'textContent', 'title', 'value'].map(p => ([p, element[p]]))),
                style: Object.fromEntries(Object.entries(element.style).filter(ent => !!ent[1]))
            }
        }
    },
    getInheritance: {
        enumerable: true, value: function (id = 'HTMLElement') {
            const inheritance = [id]
            while (id && this.extends[id]) inheritance.push(id = this.extends[id])
            return inheritance
        }
    },
    getVariable: {
        enumerable: true, value: function (variableRef, element) {
            if (!variableRef) return
            if (variableRef[0] !== '$') return variableRef
            let variableName = variableRef.slice(1)
            if (!variableName) return
            let variableValue
            if (variableName.includes('.')) {
                let variableNameSplit = variableName.split('.')
                variableValue = this.env.variables[variableNameSplit.shift()]
                if (!(variableValue instanceof Object)) return variableValue
                for (const part of variableNameSplit) {
                    variableValue = variableValue[part]
                    if (!(variableValue instanceof Object)) break
                }
            } else { variableValue = this.env.variables[variableName] }
            if (element && variableName.includes('(') && variableName.endsWith(')')) {
                let [variablePartName, ...argsRest] = mm.split('(')
                args = argsRest.join('(').slice(0, -1).split(',').map(s => s.trim())
                variableValue = this.utils.getVariableResult(variableValue, args, element)
            }
            return variableValue
        }
    },
    hydrate: {
        enumerable: true, value: function (jsonString) {
            let elementMap
            try { elementMap = JSON.parse(jsonString) } catch (e) { return }
            if (!(elementMap instanceof Object)) return
            if (!elementMap.tagName) return
            element = document.createElement(elementMap.tagName)
            for (const [k, v] of Object.entries(elementMap)) {
                if (k === 'tagName') continue
                if (k.startsWith('@')) {
                    element.setAttribute(k.slice(1), v)
                } else if (k === 'style') {
                    if (v instanceof Object) for (const [p, s] of Object.entries(v)) element.style.setProperty(p, s)
                } else { element[k] = v }
            }
            return element
        }
    },
    installLibraryFromSrc: {
        enumerable: true, value: async function (label, src, global) {
            if (!src && label && this.env.sources[label]) src = this.env.sources[label]
            label ||= src.split('/').pop().split('@')[0].replace('.min.js', '').replace('.js', '')
            global ||= label
            if (!this.env.libraries[label] && !document.querySelector(`script[src="${src}"]`)) {
                const scriptTag = document.createElement('script')
                scriptTag.setAttribute('src', src)
                document.head.append(scriptTag)
                await this.utils.waitUntil(() => window[global])
                this.env.libraries[label] = window[global]
            }
            await this.utils.waitUntil(() => this.env.libraries[label])
        }
    },
    installLibraryFromImport: {
        enumerable: true, value: async function (label, importName, doNew, src, cb, cbOptions = []) {
            if (!src && label && this.env.sources[label]) src = this.env.sources[label]
            label ||= src.split('/').pop().split('@')[0].replace('.min.js', '').replace('.js', '')
            importName ||= label
            if (!this.env.libraries[label]) {
                let moduleImport = await import(src), importToInstall
                if (importName in moduleImport) importToInstall = moduleImport[importName]
                if (!importToInstall) return
                this.env.libraries[label] = doNew ? new importToInstall() : importToInstall
                if (typeof cb === 'function') {
                    await cb(...cbOptions)
                } else if (label === 'remarkable') {
                    const plugin = (md, options) => md.core.ruler.push('html-components', parser(md, {}), { alt: [] }), parser = (md, options) => {
                        return (state) => {
                            let tokens = state.tokens, i = -1, exp = new RegExp('(<([^>]+)>)', 'gi')
                            while (++i < tokens.length) {
                                const token = tokens[i]
                                for (const child of (token.children ?? [])) {
                                    if (child.type !== 'text') return
                                    if (exp.test(child.content)) child.type = 'htmltag'
                                }
                            }
                        }
                    }
                    this.env.libraries.remarkable.use(plugin)
                }
            }
        }
    },
    resolveUrl: {
        enumerable: true, value: function (value, element) {
            if (!element) {
                if (!value.includes('://')) return value
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
                    value = typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath) : value
                }
                for (const [k, v] of Object.entries(this.env.proxies)) if (value.startsWith(k)) value = value.replace(k, v)
                return value
            } else if (value.includes(':') && !value.includes('://')) {
                let [routerName, routerPointer] = this.utils.splitOnce(value, ':'), router = this.utils.resolveMeta(element, 'e-router', routerName)
                if ((routerPointer.startsWith('/') || routerPointer.startsWith('?') || routerPointer.startsWith('#'))) {
                    const map = { '/': document.location.pathname.slice(1), '#': document.location.hash.slice(1), '?': document.location.search.slice(1) }
                    if (routerPointer[0] === '?' && (routerPointer === '[') && (routerPointer.slice(-1) === ']')) {
                        routerPointer = (new URLSearchParams(map[routerPointer[0]])).get(routerPointer.slice(2, -1))
                    } else {
                        if (routerPointer === routerPointer[0]) {
                            routerPointer = map[routerPointer[0]]
                        } else {
                            try {
                                routerPointer = map[routerPointer[0]].match(new RegExp(routerPointer.slice(1)))[0]
                            } catch (e) { routerPointer = undefined }
                        }
                    }
                }
                const rewriteRules = element.rewriteRules
                if (routerPointer && rewriteRules.length) for (const [rx, p] of rewriteRules) if ((rx instanceof RegExp) && routerPointer.match(rx)) return this.resolveUrl(p, element)
                return router ? router[element._mode](routerPointer) : this.resolveUrl(new URL(`${element._mode}/${routerPointer || this.env.modes[element._mode].pointer}.${this.env.modes[element._mode].suffix}`, element.baseURI).href)
            } else if (value.includes('/')) {
                return this.resolveUrl(new URL(value, element.baseURI).href)
            } else { return this.resolveUrl(new URL(`${element._mode}/${value}.${this.env.modes[element._mode].suffix}`, element.baseURI).href) }
        }
    },
    runTransform: {
        enumerable: true, value: async function (transform, data = {}, baseValue = undefined, element = undefined, variableMap = {}) {
            const pF = v => parseFloat(v) || 0, pI = v => parseInt(v) || 0, iA = v => Array.isArray(v) ? v : (v === undefined ? [] : [v]),
                iO = v => (v instanceof Object) ? v : {}, b = baseValue, d = typeof data === 'string' ? data.trim() : data,
                validGlobals = [
                    'Infinity', 'NaN', , 'undefined'
                ], validGlobalFunctions = [
                    'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'isFinite', 'isNaN', 'parseFloat', 'parseInt'
                ], validGlobalObjects = {
                    'Array': ['from', 'isArray', 'of'],
                    'BigInt': ['asIntN', 'asUintN'],
                    'Date': ['now', 'parse', 'UTC'],
                    'Intl': ['getCanonicalLocales', 'supportedValuesOf'],
                    'Math': '*',
                    'Number': '*',
                    'Object': '*',
                    'String': ['fromCharCode', 'fromCodePoint']
                }, shorthands = {
                    '++': () => pI(b) + 1, '--': () => pI(b) - 1,
                    '+n': () => pF(b) + pF(d), '+n': () => pF(b) - pF(d), '*n': () => pF(b) * pF(d), '/n': () => pF(b) / pF(d),
                    '^n': () => pF(b) ** pF(d), '%n': () => pF(b) % pF(d),
                    'n+': () => pF(d) - pF(b), 'n/': () => pF(d) / pF(b), 'n^': () => pF(d) ** pF(b), 'n%': () => pF(d) % pF(b),
                    '&': () => `${b}${d}`, '&s': (s) => `${b}${s}${d}`, '&/': () => `${b}\n${d}`, 's&': (s) => `${d}${s}${b}`, '/&': () => `${d}\n${b}`,
                    '[]': () => iA(b).concat(iA(d)), '[]+': () => iA(b).concat(iA(d)), '+[]': () => iA(d).concat(iA(b)),
                    '{}': () => ({ ...iO(b), ...iO(d) }), '{key}': (key) => ({ ...iO(b), [key]: d })
                }
            let result, temp
            const getArgs = t => {
                const r = {
                    [`${temp}(~)`]: [d, b], [`${temp}(...,)`]: [...iA(b), d], [`${temp}(,...)`]: [b, ...iA(d)], [`${temp}(...,...)`]: [...iA(b), ...iA(d)],
                    [`${temp}(...~)`]: [...iA(d), b], [`${temp}(~...)`]: [d, ...iA(b)], [`${temp}(...~...)`]: [...iA(d), ...iA(b)]
                }
                return r[t] ?? [b, d]
            }, resolveChild = (pr, tr, tp) => {
                pr ||= window
                tr ||= transfrom
                tp ||= temp
                const [, childName] = tr.split('.'), globalObject = pr[tp]
                if ((childName in globalObject[childName]) && (typeof globalObject[childName] !== 'function')) return globalObject[childName]
                if (childName.includes('(')) {
                    const [childFuncName,] = childName.split('(')
                    if (typeof globalObject[childFuncName] === 'function') return globalObject[childFuncName](...getArgs(`${childName}`))
                }
            }
            if (transform in shorthands) {
                return shorthands[transform]()
            } else if (validGlobals.includes(transform)) {
                return window[transform]
            } else if (temp = Object.keys(validGlobalFunctions).find(k => transform.startsWith(`${k}(`))) {
                return window[temp](...getArgs(transform))
            } else if (temp = Object.keys(validGlobalObjects).find(k => transform.startsWith(`${k}.`))) {
                return resolveChild()
            } else if (temp = Object.entries(this.env.variables).find(ent => ((transform === `$${ent[0]}`) || transform.startsWith(`$${ent[0]}{`) || transform.startsWith(`$${ent[0]}(`) || transform.startsWith(`$${ent[0]}.`)))) {
                let vars = []
                for (const [k, v] of Object.entries(this.env.variables)) if ((v instanceof Object) || (typeof v === 'Function')) vars.push(k)
                if (transform === `$${ent[0]}`) {
                    return ent[1]
                } else if (transform.startsWith(`$${ent[0]}{`)) {
                    const key = (transform.match(new RegExp(`\\$${ent[0]}\\{(.*)\\}`)) ?? [])[1]
                    return key ? { ...iO(ent[1]), [key]: d } : { ...iO(ent[1]), ...iO(d) }
                } else if (transform.startsWith(`$${ent[0]}(`)) {
                    if (typeof ent[1] === 'function') return ent[1](...getArgs(transform.slice(1)))
                } else if (transform === `$${ent[0]}.`) {
                    return resolveChild(this.env.variables, transform, ent[0])
                }
            }
            transform = this.expandTransform(transform, element, variableMap)
            if (!transform) return data
            try {
                await this.installLibraryFromSrc('jsonata')
                result = await this.E.env.libraries.jsonata(transform).evaluate(data)
            } catch (e) {
                const errors = element?.errors ?? this.env.options.errors
                if (element) element.dispatchEvent(new CustomEvent('error', { detail: { type: 'runTransform', message: e, input: { transform, data, variableMap } } }))
                if (errors === 'throw') { throw new Error(e); return } else if (errors === 'hide') { return }
            }
            return result
        }
    },
    sortByInheritance: {
        enumerable: true, writable: false, value: function (idList) {
            return Array.from(new Set(idList)).filter(t => this.extends[t]).sort((a, b) =>
                ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
                .map((v, i, a) => (i === a.length - 1) ? [v, this.extends[v]] : v).flat()
        }
    },

    classes: { value: {} },
    constructors: { value: {} },
    extends: { value: {} },
    files: { value: {} },
    ids: { value: {} },
    _observer: { enumerable: false, writable: true, value: undefined },
    scripts: { value: {} },
    styles: { value: {} },
    _styles: { value: {} },
    tags: { value: {} },
    templates: { value: {} },
    _templates: { value: {} },

    activateTag: {
        value: async function (tag, element, forceReload = false) {
            if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
            const id = await this.getTagId(tag, element);
            [this.ids[tag], this.tags[id]] = [id, tag]
            const loadResult = await this.loadTagAssetsFromId(id, forceReload)
            if (!loadResult) return
            const baseTag = this.getInheritance(id).pop() || 'HTMLElement'
            globalThis.customElements.define(tag, this.constructors[id], (baseTag && baseTag !== 'HTMLElement' & !baseTag.includes('-')) ? { extends: baseTag } : undefined)
        }
    },
    encapsulateNative: {
        value: function () {
            const HTMLElements = ['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em', 'figcaption', 'figure', 'footer', 'header',
                'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr']
            for (const tag of HTMLElements) this.ids[tag] = 'HTMLElement'
            Object.assign(this.ids, {
                a: 'HTMLAnchorElement', blockquote: 'HTMLQuoteElement', br: 'HTMLBRElement', caption: 'HTMLTableCaptionElement', col: 'HTMLTableColElement',
                colgroup: 'HTMLTableColElement', datalist: 'HTMLDataListElement', del: 'HTMLModElement', dl: 'HTMLDListElement', fieldset: 'HTMLFieldSetElement',
                h1: 'HTMLHeadingElement', h2: 'HTMLHeadingElement', h3: 'HTMLHeadingElement', h4: 'HTMLHeadingElement', h5: 'HTMLHeadingElement', h6: 'HTMLHeadingElement', hr: 'HTMLHRElement',
                iframe: 'HTMLIFrameElement', img: 'HTMLImageElement', ins: 'HTMLModElement', li: 'HTMLLIElement', ol: 'HTMLOListElement', optgroup: 'HTMLOptGroupElement',
                p: 'HTMLParagraphElement', q: 'HTMLQuoteElement', tbody: 'HTMLTableSectionElement', td: 'HTMLTableCellElement', textarea: 'HTMLTextAreaElement',
                tfoot: 'HTMLTableSectionElement', th: 'HTMLTableCellElement', th: 'HTMLTableSectionElement', tr: 'HTMLTableRowElement', ul: 'HTMLUListElement'
            })
            for (const [tag, id] in Object.entries(this.ids)) {
                if (tag.includes('-')) continue
                if (!this.tags[id]) { this.tags[id] = tag; continue }
                if (!Array.isArray(this.tags[id])) this.tags[id] = Array.of(this.tags[id])
                this.tags[id].push(tag)
            }
            const classNames = Object.values(this.ids)
            for (const nc of Reflect.ownKeys(globalThis)) if (nc.startsWith('HTML') && nc.endsWith('Element')) this.ids[nc.replace('HTML', '').replace('Element', '').toLowerCase()] ||= nc
            delete this.ids.image;
            [this.ids[''], this.ids['HTMLElement']] = ['HTMLElement', 'HTMLElement']
            for (const id in this.ids) {
                this.classes[id] = globalThis[this.ids[id]]
                this.constructors[id] = this._base(this.classes[id])
            }
        }
    },
    getTagId: {
        value: async function (tag, element) {
            if (this.ids[tag]) return this.ids[tag]
            const [routerName, pointer] = tag.split('-', 2).map(t => t.toLowerCase())
            let tagRouter = this.utils.resolveMeta(element, 'e-router', routerName)
            return await tagRouter?.element(pointer) || (new URL(`./${(routerName)}/element/${pointer}.html`,
                routerName === 'e' ? import.meta.url : element.baseURI)).href
        }
    },
    loadTagAssetsFromId: {
        value: async function (id, forceReload = false) {
            if (!id || !id.includes('://')) return
            if (!forceReload && this.files[id]) return true
            const fileFetch = await fetch(this.resolveUrl(id))
            if (fileFetch.status >= 400) return
            this.files[id] = await fileFetch.text()
            this.styles[id] = this.files[id].slice(this.files[id].indexOf('<style>') + 7, this.files[id].indexOf('</style>')).trim()
            this.templates[id] = this.files[id].slice(this.files[id].indexOf('<template>') + 10, this.files[id].indexOf('</template>')).trim()
            this.scripts[id] = this.files[id].slice(this.files[id].indexOf('<script>') + 8, this.files[id].indexOf('</script>')).trim()
            const extendsRegExp = /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/, ElementHTML = this
            let extendsId = this.scripts[id].match(extendsRegExp)?.groups?.extends || 'HTMLElement'
            if (extendsId) {
                if (extendsId.startsWith('e-')) {
                    extendsId = await this.getTagId(extendsId)
                } else if (extendsId.includes('/')) {
                    if (!extendsId.startsWith('https://') && !extendsId.startsWith('https://')) extendsId = new URL(extendsId, id).href
                    if (!extendsId.endsWith('.html')) extendsId += '.html'
                }
                this.extends[id] = extendsId
                this.files[extendsId] || !extendsId.includes('/') || await this.loadTagAssetsFromId(extendsId)
                if (!this.files[extendsId] && extendsId.includes('/')) return
            }
            let sanitizedScript = this.scripts[id].replace(extendsRegExp, `class extends ElementHTML.constructors['${extendsId}'] {`)
            this.classes[id] = Function('ElementHTML', 'return ' + sanitizedScript)(this)
            this.classes[id].id = id
            this.constructors[id] = class extends this.classes[id] { constructor() { super() } }
            return true
        }
    },
    stackStyles: {
        value: function (id) {
            if (typeof this._styles[id] === 'string') return this._styles[id]
            this._styles[id] = this.getInheritance(id).reverse().filter(id => this.styles[id]).map(id => `/** styles from '${id}' */\n` + this.styles[id]).join("\n\n")
            return this._styles[id]
        }
    },
    stackTemplates: {
        value: function (id) {
            if (typeof this._templates[id] === 'string') return this._templates[id]
            if (typeof this.templates[id] === 'string') {
                if (this.extends[id] && (this.extends[id] !== 'HTMLElement')) {
                    this._templates[this.extends[id]] = this._templates[this.extends[id]] ?? this.stackTemplates(this.extends[id])
                    if (!this.templates[id]) return this._templates[id] = this._templates[this.extends[id]]
                    const template = document.createElement('template'), childTemplate = document.createElement('template')
                    template.innerHTML = this._templates[this.extends[id]]
                    childTemplate.innerHTML = this.templates[id]
                    const childTemplatesWithSlot = childTemplate.content.querySelectorAll('template[slot]')
                    if (childTemplatesWithSlot.length) {
                        for (const t of childTemplatesWithSlot) {
                            if (!this._templates[this.extends[id]]) { t.remove(); continue }
                            let slotName = t.getAttribute('slot'), target
                            if (slotName[0] === '`' && slotName.endsWith('`')) {
                                target = template.content.querySelector(slotName.slice(1, -1))
                            } else if (slotName) {
                                target = template.content.querySelector(`slot[name="${slotName}"]`)
                            } else { target = template.content.querySelector('slot:not([name])') }
                            if (target) target.replaceWith(...t.content.cloneNode(true).childNodes)
                            t.remove()
                        }
                        const slot = template.content.querySelector('slot')
                        if (slot && childTemplate.innerHTML.trim()) slot.replaceWith(...childTemplate.content.cloneNode(true).childNodes)
                        return this._templates[id] = (this._templates[this.extends[id]] ? template.innerHTML : childTemplate.innerHTML).trim()
                    }
                }
                return this._templates[id] = this.templates[id]
            }
        }
    },

    _dispatchPropertyEvent: {
        value: function (element, eventNamePrefix, property, eventDetail) {
            eventDetail = { detail: { property: property, ...eventDetail } }
            element.dispatchEvent(new CustomEvent(eventNamePrefix, eventDetail))
            element.dispatchEvent(new CustomEvent(`${eventNamePrefix}-${property}`, eventDetail))
        }
    },

    _base: {
        value: function (baseClass = globalThis.HTMLElement) {
            return class extends baseClass {
                #_
                constructor() {
                    super()
                    const $this = this
                    if ($this.constructor.eJs || $this.constructor.eCss) {
                        const addSrcToDocument = (querySelectorTemplate, src, tagName, srcAttrName, appendTo, otherAttrs = []) => {
                            if (document.querySelector(querySelectorTemplate.replace(/\$E/g, src))) return
                            const tag = appendTo.appendChild(document.createElement(tagName))
                            tag.setAttribute(srcAttrName, src)
                            for (const a of otherAttrs) tag.setAttribute(...a)
                        }
                        if ($this.constructor.eCss && Array.isArray($this.constructor.eCss)) for (const src of $this.constructor.eCss) addSrcToDocument('link[rel="stylesheet"][href="$E"]', src, 'link', 'href', document.head, [['rel', 'stylesheet']])
                        if ($this.constructor.eJs && Array.isArray($this.constructor.eJs)) for (const src of $this.constructor.eJs) addSrcToDocument('script[src="$E"]', src, 'script', 'src', document.body)
                    }
                    if ($this.constructor.eMjs && ($this.constructor.eMjs instanceof Object)) {
                        for (const moduleName in $this.constructor.eMjs) {
                            if ($this.constructor.eMjs[moduleName].module) continue
                            if (!$this.constructor.eMjs[moduleName].src) { $this.constructor.eMjs[moduleName] = false; continue }
                            const { src, importObject } = $this.constructor.eMjs[moduleName]
                            $this.constructor.eMjs[moduleName].module = true
                            import(src).then(importResult => {
                                if (importObject) {
                                    $this.constructor.eMjs[moduleName].module = {}
                                    for (const importName in importObject) $this.constructor.eMjs[moduleName].module[importName] = importResult[importName]
                                } else { $this.constructor.eMjs[moduleName].module = importResult }
                            }).catch(e => $this.constructor.eMjs[moduleName].module = false)
                        }
                    }
                    if ($this.constructor.eWasm && ($this.constructor.eWasm instanceof Object)) {
                        for (const moduleName in $this.constructor.eWasm) {
                            if ($this.constructor.eWasm[moduleName].module || $this.constructor.eWasm[moduleName].instance || !($this.constructor.eWasm[moduleName] instanceof Object)) continue
                            if (!$this.constructor.eWasm[moduleName].src) { $this.constructor.eWasm[moduleName] = false; continue }
                            const { src, importObject } = $this.constructor.eWasm[moduleName]
                            $this.constructor.eWasm[moduleName] = true
                            WebAssembly.instantiateStreaming(fetch(ElementHTML.resolveUrl(src)), importObject).then(importResult =>
                                $this.constructor.eWasm[moduleName] = importResult
                            ).catch(e => $this.constructor.eWasm[moduleName] = false)
                        }
                    }
                    Object.defineProperties($this, {
                        E: { enumerable: true, value: ElementHTML },
                        eContext: { enumerable: true, value: {} },
                        eDataset: {
                            enumerable: true, value: new Proxy($this.dataset, {
                                has(target, property) {
                                    const override = (ElementHTML.env.map.get($this) ?? {})['eDatasetHas']
                                    if (override) return typeof override === 'function' ? override($this, target, property) : override
                                    switch (property[0]) {
                                        case '@':
                                            return $this.hasAttribute(property.slice(1))
                                        case '.':
                                            return property.slice(1) in $this
                                        default:
                                            return property.includes('-') ? (property.replaceAll('-', '__') in target) : (property in target)
                                    }
                                },
                                get(target, property, receiver) {
                                    const override = (ElementHTML.env.map.get($this) ?? {})['eDatasetGet']
                                    if (override) return typeof override === 'function' ? override($this, target, property, receiver) : override
                                    switch (property[0]) {
                                        case '@':
                                            return $this.getAttribute(property.slice(1))
                                        case '.':
                                            return $this[property.slice(1)]
                                        default:
                                            return property.includes('-') ? target[property.replaceAll('-', '__')] : target[property]
                                    }
                                },
                                set(target, property, value, receiver) {
                                    const override = (ElementHTML.env.map.get($this) ?? {})['eDatasetSet']
                                    if (override) return typeof override === 'function' ? override($this, target, property, value, receiver) : override
                                    switch (property[0]) {
                                        case '@':
                                            if (value === null || value === undefined) {
                                                return $this.removeAttribute(property.slice(1))
                                            } else { return $this.setAttribute(property.slice(1), value) }
                                        case '.':
                                            if (value === null || value === undefined) {
                                                return delete $this[property.slice(1)]
                                            } else { return $this[property.slice(1)] = value }
                                        default:
                                            let oldValue
                                            if (property.includes('-')) {
                                                const safeProperty = property.replaceAll('-', '__')
                                                oldValue = target[safeProperty]
                                                target[safeProperty] = value
                                            } else {
                                                oldValue = target[property]
                                                target[property] = value
                                            }
                                            ElementHTML._dispatchPropertyEvent($this, 'change', property, { property: property, value: value, oldValue: oldValue })
                                            return value
                                    }
                                },
                                deleteProperty(target, property) {
                                    const override = (ElementHTML.env.map.get($this) ?? {})['eDatasetDeleteProperty']
                                    if (override) return typeof override === 'function' ? override($this, target, property) : override
                                    switch (property[0]) {
                                        case '@':
                                            return $this.removeAttribute(property.slice(1))
                                        case '.':
                                            return delete $this[property.slice(1)]
                                        default:
                                            let retval, oldValue
                                            if (property.includes('-')) {
                                                const safeProperty = property.replaceAll('-', '__')
                                                oldValue = target[safeProperty]
                                                retval = delete target[safeProperty]
                                            } else {
                                                oldValue = target[property]
                                                retval = delete target[property]
                                            }
                                            ElementHTML._dispatchPropertyEvent($this, 'deleteProperty', property, { property: property, value: undefined, oldValue: oldValue })
                                            return retval
                                    }
                                }
                            })
                        }
                    })
                    try {
                        $this.shadowRoot || $this.attachShadow({ mode: 'open' })
                        $this.shadowRoot.textContent = ''
                        $this.shadowRoot.appendChild(document.createElement('style')).textContent = ElementHTML._styles[this.constructor.id] ?? ElementHTML.stackStyles(this.constructor.id)
                        const templateNode = document.createElement('template')
                        templateNode.innerHTML = ElementHTML._templates[this.constructor.id] ?? ElementHTML.stackTemplates(this.constructor.id)
                        $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
                        window.requestAnimationFrame(() => {
                            this.dispatchEvent(new CustomEvent('ready'))
                            this.readyCallback()
                        })
                    } catch (e) { }
                }
                static get observedAttributes() { return ['_'] }
                static E = ElementHTML
                async connectedCallback() { this.dispatchEvent(new CustomEvent('connected')) }
                async readyCallback() { }
                attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
                valueOf() { return this.E.flatten(this) }
                set _(value) { this.#_ = value }
                get _() { return this.#_ }
            }
        }
    }
})

let metaUrl = new URL(import.meta.url), metaOptions = (ElementHTML.utils.parseObjectAttribute(metaUrl.search) || {})
if (metaOptions.packages) {
    for (const p of packages.split(',').map(s => s.trim())) {
        if (!p) continue
        const packageUrl = p.includes('/') ? ElementHTML.resolveUrl(p) : ElementHTML.resolveUrl(`ipfs://${p}`)
        ElementHTML.ImportPackage(await import(packageUrl))
    }
}
let expose = metaOptions.Expose || metaOptions.expose, load = metaOptions.Load || metaOptions.load
if (typeof load === 'string') {
    if (!(typeof expose == 'string' && !expose && window.E) && !(expose && window[expose])) {
        for (const [func, args] of Object.entries(metaOptions)) if ((func !== 'load') && (func !== 'Expose') && (typeof ElementHTML[func] === 'function')) if (args.startsWith('[') && args.endsWith(']')) {
            try { await ElementHTML[func](...JSON.parse(args)) } catch (e) { await ElementHTML[func](args) }
        } else { await ElementHTML[func](args) }
        if (typeof expose === 'string') await ElementHTML.Expose(expose)
        await ElementHTML.load()
    }
}

export { ElementHTML }