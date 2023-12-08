const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '0.9.6' },

    env: {
        enumerable: true, value: {
            eDataset: new EventTarget(),
            gateways: {
                ipfs: (hostpath, E) => {
                    const [cid, ...path] = hostpath.split('/')
                    return `https://${cid}.ipfs.dweb.link/${path.join('/')}}`
                },
                ipns: (hostpath, E) => {
                    const [cid, ...path] = hostpath.split('/')
                    return `https://${cid}.ipns.dweb.link/${path.join('/')}}`
                },
                jsonata: (hostpath, E) => {
                    hostpath = hostpath.endsWith('.jsonata') ? hostpath : `${hostpath}.jsonata`
                    return new URL(hostpath, document.baseURI).href
                },
            },
            libraries: {},
            map: new WeakMap(),
            modes: {
                element: 'element/element.html', content: 'content/content.html', data: 'data/data.json',
                theme: 'theme/theme.css', schema: 'schema/schema.schema.json', plugin: 'plugin/plugin.js',
                publish: 'publish/manifest.json', pod: 'pod/db.js'
            },
            options: {
                ajv: {
                    enumerable: true, value: {
                        allErrors: true, verbose: true, validateSchema: 'log', coerceTypes: true,
                        strictSchema: false, strictTypes: false, strictTuples: false, allowUnionTypes: true, allowMatchingProperties: true
                    }
                },
                errors: 'hide',
                remarkable: {
                    html: true
                },
                security: { allowTemplateUseScripts: false, allowTemplateUseCustom: [] },
                defaultEventTypes: { input: 'change', meta: 'change', textarea: 'change', select: 'change', form: 'submit' },
                elementPropertiesToFlatten: ['baseURI', 'checked', 'childElementCount', 'className',
                    'clientHeight', 'clientLeft', 'clientTop', 'clientWidth',
                    'id', 'innerHTML', 'innerText', 'lang', 'localName', 'name', 'namespaceURI',
                    'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'outerHTML', 'outerText', 'prefix',
                    'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop', 'scrollTopMax', 'scrollWidth',
                    'selected', 'slot', 'tagName', 'textContent', 'title']
            },
            proxies: {},
            sources: {
                jsonata: 'https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js',
                remarkable: 'https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm'
            },
            cells: {},
            transforms: {},
            ports: {},
            variables: {}
        }
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
            idleCallback: {
                enumerable: true, value: async function (cb, timeout) {
                    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 0))
                    return idle(cb, { timeout })
                }
            },
            parseObjectAttribute: {
                enumerable: true, value: function (value, element) {
                    let retval = ElementHTML.resolveVariables(value)
                    if (typeof retval === 'string') {
                        if (retval[0] === '?') retval = decodeURIComponent(retval).slice(1)
                        if ((retval[0] === '{') && (retval.slice(-1) === '}')) {
                            try { retval = JSON.parse(retval) } catch (e) { console.log('line 97', e) }
                        } else {
                            try { retval = Object.fromEntries((new URLSearchParams(retval)).entries()) } catch (e) { }
                        }
                    }
                    if (retval instanceof Object) for (const k in retval) retval[k] = ElementHTML.resolveVariables(retval[k])
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
                enumerable: true, value: function (scopeStatement, element) {
                    if (!scopeStatement) return element.parentElement
                    let scope
                    if (scopeStatement === ':') {
                        const root = element.getRootNode()
                        scope = (root instanceof ShadowRoot) ? root : document.body
                    } else if (scopeStatement === ':root') {
                        scope = element.getRootNode()
                        if (scope === document) scope = document.documentElement
                    } else if (scopeStatement === ':host') {
                        scope = element.getRootNode()
                        if (scope instanceof ShadowRoot) scope = scope.host
                        if (scope === document) scope = document.documentElement
                    } else if (scopeStatement === ':document') {
                        scope = document.documentElement
                    } else if (scopeStatement === ':body') {
                        scope = document.body
                    } else if (scopeStatement === ':head') {
                        scope = document.head
                    } else { scope = element.closest(scopeStatement) }
                    return scope
                }
            },
            resolveSelector: {
                enumerable: true, value: function (selector, scope) {
                    let selected
                    if (!selector) {
                        selected = scope
                    } else if (selector.includes('{') && selector.endsWith('}')) {
                        let [selectorStem, sig] = selector.split('{')
                        selected = this.sliceAndStep(sig.slice(0, -1), Array.from(scope.querySelectorAll(selectorStem)))
                    } else {
                        selected = scope.querySelector(selector)
                    }
                    return selected
                }
            },
            resolveScopedSelector: {
                enumerable: true, value: function (scopedSelector, element) {
                    let scope = element, selector = scopedSelector
                    if (selector.includes('|')) {
                        const [scopeStatement, selectorStatement] = selector.split('|').map(s => s.trim())
                        scope = this.resolveScope(scopeStatement, element)
                        selector = selectorStatement
                    }
                    return this.resolveSelector(selector, scope)
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
                if (this.env._globalLoadCalled) return
                this.env._globalLoadCalled = true
                this.env.ElementHTML = this
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
                this.env.modes = newModes
                Object.freeze(this.env)
                Object.freeze(this.env.gateways)
                Object.freeze(this.env.modes)
                Object.freeze(this.env.options.security)
                Object.freeze(this.env.proxies)
                Object.freeze(this.env.sources)
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
            if (typeof globalName !== 'string') globalName = 'E'
            if (!globalName) globalName = 'E'
            if (globalName && !window[globalName]) window[globalName] = this
        }
    },
    ImportPackage: {
        enumerable: true, value: async function (packageObject) {
            if (typeof packageObject !== 'object') return
            let packageContents = packageObject.default ?? {}
            if ((typeof packageObject.loader === 'function')) packageContents = await packageObject.loader(packageObject.bootstrap ?? {})
            for (const a of ['eDataset', 'gateways', 'modes', 'options', 'proxies', 'sources', 'variables']) {
                if (packageContents[a] instanceof Object) Object.assign(this.env[a], packageContents[a])
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
            if (value instanceof Object) {
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
    applyData: {
        enumerable: true, value: async function (element, data, silent) {
            if (!(element instanceof HTMLElement)) return
            if (data === null) element.remove()
            if (!(data instanceof Object)) return this.setValue(element, data, silent)
            const setProperty = (k, v, element) => {
                if (k.includes('(') && k.endsWith(')')) {
                    this.runElementMethod(k, v, element)
                } else {
                    if (v === undefined) {
                        delete element[k]
                    } else { element[k] = v }
                }
            }
            for (const [k, v] of Object.entries(data)) {
                if (!k) continue
                switch (k[0]) {
                    case '#':
                        if (k === '#') element.setAttribute('id', v)
                        break
                    case '&':
                        const className = k.slice(1)
                        if (!className) continue
                        element.classList.toggle(className, v)
                        break
                    case '^':
                        const styleRule = k.slice(1)
                        if (!styleRule) continue
                        if (v === null) {
                            element.style.removeProperty(styleRule)
                        } else {
                            element.style.setProperty(styleRule, v)
                        }
                        break
                    case '@':
                        if (v === null) {
                            element.removeAttribute(k.slice(1))
                        } else if ((v === true) || (v === false)) {
                            element.toggleAttribute(k.slice(1), v)
                        } else { element.setAttribute(k.slice(1), v) }
                        break
                    case '!':
                        let eventName = k.slice(1)
                        if (!eventName) eventName = this.env.options.defaultEventTypes[element.tagName.toLowerCase()] ?? 'click'
                        if (v === null) {
                            element.addEventListener(eventName, event => event.preventDefault(), { once: true })
                        } else {
                            element.dispatchEvent(new CustomEvent(eventName, { detail: v }))
                        }
                        break
                    case '.':
                    case '<':
                        if (!v) { element.replaceChildren(); continue }
                        if (k === '<>') {
                            element.innerHTML = v
                        } else if (k[0] === '<' && k.slice(-1) === '>') {
                            const posMap = { '?++': 'after', '?--': 'before', '?-': 'prepend', '?+': 'append', '?**': 'replaceWith', '?*': 'replaceChildren' }
                            let renderExpression = k.slice(1, -1), insertSelector,
                                posMatch = renderExpression.match(new RegExp((Object.keys(posMap).map(s => `( \\${s.split('').join('\\')} )`).join('|')), 'gi'))
                            if (posMatch) [renderExpression, insertSelector] = renderExpression.split(posMatch).map(s => s.trim())
                            if (renderExpression[0] === '%' && renderExpression.slice(-1) === '%') {
                                const useTemplate = this.utils.resolveScopedSelector(renderExpression.slice(1, -1), element)
                                if (useTemplate) this.applyDataWithTemplate(element, v, useTemplate, posMap[(posMatch ?? '').trim()], insertSelector)
                            } else {
                                const tagMatch = renderExpression.match(/^[a-z0-9\-]+/g) ?? [],
                                    idMatch = renderExpression.match(/(\#[a-zA-Z0-9\-]+)+/g) ?? [], classMatch = renderExpression.match(/(\.[a-zA-Z0-9\-]+)+/g) ?? [],
                                    attrMatch = renderExpression.match(/\[[a-zA-Z0-9\-\= ]+\]/g) ?? []
                                this.applyDataWithTemplate(element, v, tagMatch[0], posMap[(posMatch ?? '').trim()], insertSelector, (idMatch[0] ?? '').slice(1),
                                    (classMatch[0] ?? '').slice(1).split('.').map(s => s.trim()).filter(s => !!s),
                                    Object.fromEntries((attrMatch ?? []).map(m => m.slice(1, -1)).map(m => m.split('=').map(ss => ss.trim())))
                                )
                            }
                        } else if (k === '.') {
                            element[v.includes('<') && v.includes('>') ? 'innerHTML' : 'textContent'] = v
                        } else if (k === '..') {
                            element.textContent = v
                        } else if (k === '...') {
                            element.innerText = v
                        } else { setProperty(k.slice(1), v, element) }
                        break
                    case '`':
                        let nestingTargets = this.utils.resolveScopedSelector(k.slice(1, -1), element)
                        if (!Array.isArray(nestingTargets)) nestingTargets = [nestingTargets]
                        await Promise.all(nestingTargets.map(t => this.applyData(t, v, silent)))
                        break
                    case '~':
                        this.env.variables[k.slice(1)] = v
                        break
                    default:
                        setProperty(k, v, element)
                }
            }
        },
    },

    applyDataWithTemplate: {
        enumerable: true, value: function (element, data, tag, insertPosition, insertSelector, id, classList, attributeMap) {
            if (insertSelector) element = element.querySelector(insertSelector)
            if (!element) return
            const sort = Array.prototype.toSorted ? 'toSorted' : 'sort'
            classList = (classList && Array.isArray(classList)) ? classList.map(s => s.trim()).filter(s => !!s)[sort]() : []
            const attrEntries = (attributeMap && (attributeMap instanceof Object)) ? Object.entries(attributeMap) : []
            insertPosition ||= 'replaceChildren'
            let useNode
            if (tag instanceof HTMLTemplateElement) {
                useNode = tag.content.cloneNode(true).firstElementChild
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
                for (const vv of data) nodesToApply.push([buildNode(useNode.cloneNode(true)), vv])
            } else { nodesToApply.push([buildNode(useNode), data]) }
            element[insertPosition](...nodesToApply.map(n => n[0]))
            for (const n of nodesToApply) this.applyData(...n)
        }
    },

    runElementMethod: {
        enumerable: true, value: function (statement, arg, element) {
            let [funcName, ...argsRest] = statement.split('(')
            if (typeof element[funcName] === 'function') {
                argsRest = argsRest.join('(').slice(0, -1)
                argsRest = argsRest ? argsRest.split(',').map(a => this.resolveVariables('${' + a.trim() + '}', element)) : []
                return element[funcName](...argsRest, arg)
            }
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
            if (requestOptions.$ && typeof requestOptions.$ === 'string' && requestOptions.$.startsWith('$')) {
                let variableValue = this.getVariable(requestOptions.$, element)
                if (variableValue && (variableValue instanceof Object)) {
                    requestOptions.headers = { ...(variableValue.headers ?? {}), ...(requestOptions.headers ?? {}) }
                    requestOptions = { ...variableValue, ...requestOptions }
                }
            }
            let headers = requestOptions.headers ?? {}, contentType = headers['Content-Type'] ?? headers['content-type'] ?? headers.contentType
            for (const [k, v] of Object.entries(element.dataset)) if (k.startsWith('eHeader')) headers[k.slice(7)] = v
            contentType ||= element.getAttribute('content-type') || element._contentType
            requestOptions.headers = headers
            if (!contentType && body) contentType ||= defaultContentType
            if (contentType) {
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
    flatten: {
        enumerable: true, value: function (value, key) {
            let result
            const compile = (plain, complex = []) => {
                return {
                    ...Object.fromEntries(plain.filter(p => value[p] !== undefined).map(p => ([p, value[p]]))),
                    ...Object.fromEntries(complex.filter(p => value[p] !== undefined).map(p => ([p, this.flatten(value[p])])))
                }
            }
            if (!(value instanceof Object)) {
                result = value
            } else if (Array.isArray(value)) {
                result = value.map(e => this.flatten(e, key))
            } else if (value instanceof HTMLElement) {
                const override = (this.env.map.get(value) ?? {})['eFlatten']
                if (override) return typeof override === 'function' ? override(value) : override
                const classList = Object.fromEntries(Object.values(value.classList).map(c => [c, true])),
                    style = Object.fromEntries(Object.entries(value.style).filter(ent => !!ent[1] && (parseInt(ent[0]) != ent[0]))),
                    innerHTML = value.innerHTML, textContent = value.textContent, innerText = value.innerText
                result = {
                    ...Object.fromEntries(value.getAttributeNames().map(a => ([`@${a}`, value.getAttribute(a)]))),
                    ...Object.fromEntries(Object.entries(compile(['baseURI', 'checked', 'childElementCount', 'className',
                        'clientHeight', 'clientLeft', 'clientTop', 'clientWidth',
                        'id', 'lang', 'localName', 'name', 'namespaceURI',
                        'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'outerHTML', 'outerText', 'prefix',
                        'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop', 'scrollTopMax', 'scrollWidth',
                        'selected', 'slot', 'tagName', 'title'], [])).filter(ent => ent[1] === '')),
                    innerHTML, textContent, innerText, style, classList, tag: (value.getAttribute('is') || value.tagName).toLowerCase(),
                    '.': (textContent.includes('<') && textContent.includes('>')) ? innerHTML : textContent,
                    '..': textContent, '...': innerText, '<>': innerHTML,
                    value: 'value' in value ? value.value : undefined, '#': value.id, _: getValue(value)
                }
                for (const c of Object.keys(classList)) result[`&${c}`] = true
                for (const ent of Object.entries(style)) result[`^${ent[0]}`] = ent[1]
                if (result.tag === 'form' || result.tag === 'fieldset') {
                    result._ = {}
                    for (const c of value.querySelectorAll('[name]')) result._[c.name] ||= this.flatten(c)
                } else if (result.tag === 'table') {
                    result._ = []
                    const rows = Array.from(value.querySelectorAll('tr')), headers = Array.from(rows.shift().querySelectorAll('th'))
                    for (const [index, header] of headers.entries()) {
                        for (const [i, row] of rows.entries()) {
                            result._[i - 1] ||= {}
                            const cell = rows[i].querySelectorAll('td')[index]
                            result._[i - 1][header.textContent] = this.flatten(cell)
                        }
                    }
                } else if (['data', 'meter', 'input', 'select', 'textarea'].includes(result.tag)) {
                    result._ = value.value
                } else if (result.tag === 'time') {
                    result._ = value.getAttribute('datetime')
                } else if (result.tag === 'meta' && !value.hasAttribute('is')) {
                    result._ = value.getAttribute('content')
                } else if (value.hasAttribute('itemscope')) {
                    for (const c of value.querySelectorAll('[itemprop]')) result._[c.getAttribute('itemprop')] ||= this.flatten(c)
                } else {
                    result._ = innerText.trim()
                }
            } else if (value instanceof Event) {
                result = compile(
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
            } else if (value instanceof Blob) {
                result = compile(['size', 'type'])
            } else if (value instanceof DataTransfer) {
                result = compile(['dropEffect', 'effectAllowed', 'types'])
            } else if (value instanceof FormData) {
                result = Object.fromEntries(value.entries())
            } else if (value instanceof Object) {
                result = Object.fromEntries(Object.entries(value).filter(ent => typeof ent[1] !== 'function'))
                result = key ? result[key] : result
            }
            return result
        }
    },
    getInheritance: {
        enumerable: true, value: function (id = 'HTMLElement') {
            const inheritance = [id]
            while (id && this.extends[id]) inheritance.push(id = this.extends[id])
            return inheritance
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
                } else if (k === 'value') {
                    try { element.value = v } catch (e) { }
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

    getVariable: {
        enumerable: true, value: function (variableRef, element) {
            if (!variableRef) return
            let variableName = variableRef.slice(1), variableValue = variableRef
            if (element && variableName && variableRef[0] === '@') {
                return element.getAttribute(variableName)
            } else if (element && variableName && variableRef[0] === '.' && !variableRef.includes('/')) {
                return element[variableName]
            } else if (variableName && variableRef[0] === '$') {
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
            }
            return variableValue
        }
    },
    mergeVariables: {
        enumerable: true, value: function (statement, element) {
            if (!statement) return
            for (const expression of statement.matchAll(/\{(?<variableExpression>.+?)\}/g)) {
                let { variableExpression } = (expression?.groups ?? {})
                if (!variableExpression) continue
                let variableRef = variableExpression, args = [element]
                if (variableExpression.includes('(')) {
                    let [variablePartName, ...argsRest] = variableExpression.split('(')
                    args.push(argsRest.join('(').slice(0, -1).split(',').map(s => this.getVariable(s.trim(), element)))
                    variableRef = variablePartName
                }
                let variableResult = this.getVariable(variableRef, element)
                if (typeof variableResult === 'function') variableResult = variableResult(...args)
                variableResult ||= ''
                if (typeof variableResult !== 'string') variableResult = JSON.stringify(variableResult)
                statement = statement.replaceAll(`{${variableExpression}}`, variableResult)
            }
            return statement
        }
    },
    resolveVariables: {
        enumerable: true, value: function (statement, element) {
            if (!statement) return
            const regExp = /\$\{(.+?)\}/g, isMatch = statement.match(regExp)
            if (!isMatch) return statement
            if (statement[2] === '[' && statement.endsWith(']}')) {
                return statement.slice(3, -2).split(',').map(s => this.resolveVariables(s.trim(), element))
            } else if (statement[2] === '{' && statement.endsWith('}}')) {
                return Object.fromEntries(statement.slice(3, -2).split(',').map(s => {
                    const [k, v] = s.trim().split(':').map(ss => s.trim())
                    return [k, this.resolveVariables(v, element)]
                }))
            }
            const merge = (expression) => {
                if (expression) expression = expression.slice(2, -1)
                if (!expression) return element ? this.flatten(element) : undefined
                let [varName, ...args] = expression.split('(').map(s => s.trim()), varValue
                if (!varName) return element ? this.flatten(element) : undefined
                switch (varName[0]) {
                    case '"':
                    case "'":
                        varValue = varName.slice(1, -1)
                        break
                    case '#':
                        if (varName === '#') {
                            varValue = element.id
                        } else {
                            varValue = this.getCell(varName.slice(1)).get()
                        }
                        break
                    case '&':
                        varValue = element.classList.contains(varName.slice(1))
                        break
                    case '^':
                        varValue = element.style.getPropertyValue(varName.slice(1))
                        break
                    case '@':
                        varValue = element.getAttribute(varName.slice(1))
                        if (varValue === '') varValue = true
                        break
                    case '.':
                        if (varName === '.') {
                            varValue = element.textContent
                            if (varValue.includes('<') && varValue.includes('>')) {
                                varValue = element.innerHTML
                            }
                        } else if (varName === '..') {
                            varValue = element.textContent
                        } else if (varName === '...') {
                            varValue = element.innerText
                        }
                        break
                    case '<':
                        if (varName === '<>') {
                            varValue = element.innerHTML
                        } else {
                            varName = varName.slice(1, -1)
                            varValue = (varName[0] === '%')
                                ? this.getValue(this.utils.resolveScopedSelector(varName.slice(1, -1), element))
                                : this.getValue(this.utils.resolveSelector(varName, element))
                        }
                        break
                    case '`':
                        let [nestedScopedSelector, ...nestedVariableNames] = varName.slice(1).split('`')
                        nestedVariableNames = nestedVariableNames.join('`')
                        const nestedElement = this.utils.resolveScopedSelector(nestedScopedSelector, element)
                        if (nestedElement) varValue = this.resolveVariables('${' + nestedVariableNames + '}', nestedElement)
                        break
                    case '~':
                        varName = varName.slice(1)
                        if (varName.includes('.')) {
                            let varNameSplit = varName.split('.').map(s => s.trim())
                            varValue = this.env.variables[varNameSplit.shift()]
                            if (!(varValue instanceof Function) && (varValue instanceof Object)) for (const part of varNameSplit) {
                                varValue = varValue[part]
                                if (!(varValue instanceof Object) || (varValue instanceof Function)) break
                            }
                        } else { varValue = this.env.variables[varName] }
                        break
                    default:
                        varValue = element[varName]
                }
                if (expression.includes('(') && expression.endsWith(')')) {
                    if (typeof varValue === 'function') {
                        args = args.join('(').slice(0, -1).split(',').map(s => s.trim()).map(a => this.resolveVariables('${' + a + '}', element))
                        varValue = varValue(...args)
                    } else {
                        varValue = undefined
                    }
                }
                return varValue
            }
            return ((isMatch.length === 1) && (isMatch[0] === statement)) ? merge(statement) : statement.replace(regExp, merge)
        }
    },


    getCell: {
        enumerable: true, value: function (name) {
            if (!name) return
            const cells = this.env.cells
            if (!cells[name]) {
                const cell = {
                    channel: new BroadcastChannel(name),
                    eventTarget: new EventTarget(),
                    get: function () { return this.value },
                    set: function (value, force) {
                        if (this.value === value) {
                            if (force) cell.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                            return
                        }
                        this.channel.postMessage(value)
                        this.value = value
                        cell.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                    },
                    value: undefined, name
                }
                cell.channel.addEventListener('message', event => {
                    if (event.data === cell.value) return
                    cell.value = event.data
                    cell.eventTarget.dispatchEvent(new CustomEvent('change', { detail: event.data }))
                })
                cells[name] = cell
            }
            return cells[name]
        }
    },

    resolveUrl: {
        enumerable: true, value: function (value, element) {
            if (!element) {
                if (!value.includes('://')) return value
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
                    value = typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath, this) : value
                }
                if (typeof value !== 'string') return value
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
        enumerable: true, value: async function (transform, data = {}, element = undefined, variableMap = {}) {
            if (transform) transform = transform.trim()
            const transformKey = transform
            let expression
            if ((transformKey[0] === '`') && transformKey.endsWith('`')) {
                transform = this.env.transforms[transformKey] ? this.env.transforms[transformKey][0] : await fetch(this.resolveUrl(transformKey.slice(1, -1).trim())).then(r => r.text())
                expression = this.env.transforms[transformKey] ? this.env.transforms[transformKey][1] : undefined
            }
            if (!transform) return data
            try {
                await this.installLibraryFromSrc('jsonata')
                this.env.transforms[transformKey] ||= [transform, this.env.libraries.jsonata(transform)]
                expression ||= this.env.transforms[transformKey][1]
                const bindings = {}
                if (transform.includes('$console(')) bindings.console = (...m) => console.log(...m)
                if (transform.includes('$stop(')) bindings.stop = v => v
                if (transform.includes('$getCell(')) bindings.getCell = name => name ? this.getCell(name).get() : undefined
                if (transform.includes('$uuid()')) bindings.uuid = () => crypto.randomUUID()
                const date = new Date(),
                    dateMethods = ['toDateString', 'toString', 'valueOf', 'toISOString', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString', 'toTimeString', 'toUTCString']
                for (const dm of dateMethods) if (transform.includes(`$Date${dm}`)) bindings[`Date${dm}`] = date[dm]
                if (element && transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.utils.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)
                if (element && transform.includes('$this')) bindings.this = this.flatten(element)
                if (element && transform.includes('$root')) bindings.root = this.flatten(element.getRootNode())
                if (element && transform.includes('$host')) bindings.host = this.flatten(element.getRootNode().host)
                const nearby = ['parentElement', 'firstElementChild', 'lastElementChild', 'nextElementSibling', 'previousElementSibling']
                for (const p of nearby) if (element && transform.includes(`$${p}`)) bindings[p] = this.flatten(element[p])
                for (const [k, v] of Object.entries(this.env.variables)) if (transform.includes(`$${k}`)) bindings[k] = v
                for (const [k, v] of Object.entries(variableMap)) if (transform.includes(`$${k}`)) bindings[k] = this.flatten(v)
                //console.log('line 1119', transform, data, bindings)
                return await expression.evaluate(data, bindings)
            } catch (e) {
                console.log('line 1121', e)
                const errors = element?.errors ?? this.env.options.errors
                if (element) element.dispatchEvent(new CustomEvent('error', { detail: { type: 'runTransform', message: e, input: { transform, data, variableMap } } }))
                if (errors === 'throw') { throw new Error(e); return } else if (errors === 'hide') { return }
            }
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
            if (!globalThis.customElements.get(tag)) globalThis.customElements.define(tag, this.constructors[id], (baseTag && baseTag !== 'HTMLElement' & !baseTag.includes('-')) ? { extends: baseTag } : undefined)
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
                        E: { enumerable: false, value: ElementHTML },
                        eContext: { enumerable: false, value: {} },
                        eDataset: {
                            enumerable: false, value: new Proxy($this.dataset, {
                                has(target, property) {
                                    const override = (ElementHTML.env.map.get($this) ?? {})['eDatasetHas']
                                    if (override) return typeof override === 'function' ? override($this, target, property) : override
                                    switch (property[0]) {
                                        case '@':
                                            return $this.hasAttribute(property.slice(1))
                                        case '.':
                                            return property.slice(1) in $this
                                        case '`':
                                            const [qs, p] = property.slice(1).split('`')
                                            if (!qs) return false
                                            const el = qs[0] === '~' ? $this.shadowRoot.querySelector(qs.slice(1)) : $this.querySelector(qs)
                                            if (!el) return false
                                            if (!p) return true
                                            return p[0] === '@' ? el.hasAttribute(p.slice(1))
                                                : (p[0] === '.' ? (p.slice(1) in el)
                                                    : p.includes('-') ? (p.replaceAll('-', '__') in el) : (p in el))
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
                                        case '`':
                                            const [qs, p] = property.slice(1).split('`')
                                            if (!qs) return false
                                            const el = qs[0] === '~' ? $this.shadowRoot.querySelector(qs.slice(1)) : $this.querySelector(qs)
                                            if (!el) return false
                                            if (!p) return true
                                            return p[0] === '@' ? el.getAttribute(p.slice(1))
                                                : (p[0] === '.' ? el[p.slice(1)]
                                                    : p.includes('-') ? el[p.replaceAll('-', '__')] : el[p])
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
                                                return $this.removeAttribute(property.slice(1)) ?? true
                                            } else { return $this.setAttribute(property.slice(1), value) ?? true }
                                        case '.':
                                            if (value === null || value === undefined) {
                                                return delete $this[property.slice(1)] ?? true
                                            } else { return ($this[property.slice(1)] = value) ?? true }
                                        case '`':
                                            const [qs, p] = property.slice(1).split('`')
                                            if (!qs) return
                                            const el = qs[0] === '~' ? $this.shadowRoot.querySelector(qs.slice(1)) : $this.querySelector(qs)
                                            if (!el) return true
                                            if (!p) return this.setValue(el, value) ?? true
                                            return (p[0] === '@' ? el.setAttribute(p.slice(1), value)
                                                : (p[0] === '.' ? el[p.slice(1)] = value
                                                    : p.includes('-') ? el[p.replaceAll('-', '__')] : el[p] = value)) ?? true
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
                                            return $this.removeAttribute(property.slice(1)) ?? true
                                        case '.':
                                            return delete $this[property.slice(1)]
                                        case '`':
                                            const [qs, p] = property.slice(1).split('`')
                                            if (!qs) return
                                            const el = qs[0] === '~' ? $this.shadowRoot.querySelector(qs.slice(1)) : $this.querySelector(qs)
                                            if (!el) return
                                            if (!p) return el.remove()
                                            return (p[0] === '@' ? el.removeAttribute(p.slice(1))
                                                : (p[0] === '.' ? delete el[p.slice(1)]
                                                    : p.includes('-') ? el[p.replaceAll('-', '__')] : delete el[p])) ?? true
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
    const importmapElement = document.head.querySelector('script[type="importmap]')
    let importmap = { imports: {} }
    if (importmapElement) try { importmap = JSON.parse(importmapElement.textContent.trim()) } catch (e) { }
    const imports = importmap.imports ?? {}
    for (const p of metaOptions.packages.split(',').map(s => s.trim())) {
        if (!p) continue
        if ((typeof imports[p] === 'string') && imports[p].includes('/')) p = ElementHTML.resolveUrl(imports[p])
        await ElementHTML.ImportPackage(await import(p))
    }
}
let expose = metaOptions.Expose ?? metaOptions.expose ?? (('Expose' in metaOptions) || ('expose' in metaOptions))
if (expose) await ElementHTML.Expose(expose)
if (('Load' in metaOptions) || ('load' in metaOptions)) await ElementHTML.load()

export { ElementHTML }