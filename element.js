const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '0.9.8' },

    sys: {
        enumerable: false, value: {
            defaultEventTypes: { input: 'change', meta: 'change', textarea: 'change', select: 'change', form: 'submit' },
            regexp: {
                extends: /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/,
                htmlBlocks: /<html>\n+.*\n+<\/html>/g,
                htmlSpans: /<html>.*<\/html>/g,
                tagMatch: /^[a-z0-9\-]+/g,
                idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                classMatch: /(\.[a-zA-Z0-9\-]+)+/g,
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g
            }
        }
    },

    env: {
        enumerable: true, value: {
            gateways: {
                ipfs: (hostpath, E) => {
                    const [cid, ...path] = hostpath.split('/')
                    return `https://${cid}.ipfs.dweb.link/${path.join('/')}}`
                },
                ipns: (hostpath, E) => {
                    const [cid, ...path] = hostpath.split('/')
                    return `https://${cid}.ipns.dweb.link/${path.join('/')}}`
                }
            },
            helpers: {},
            libraries: {},
            options: {
                ajv: {
                    enumerable: true, value: {
                        allErrors: true, verbose: true, validateSchema: 'log', coerceTypes: true,
                        strictSchema: false, strictTypes: false, strictTuples: false, allowUnionTypes: true, allowMatchingProperties: true
                    }
                },
                remarkable: { html: true },
            },
            schemas: {},
            cells: {},
            namespaces: {},
            transforms: {},
            schemas: {},
            context: {}
        }
    },

    utils: {
        enumerable: true, value: Object.defineProperties({}, {
            getCustomTag: {//keep
                enumerable: true, value: function (element) {
                    return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                        || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
                }
            },
            getWasm: {//keep
                enumerable: true, value: async function (req, options) {
                    if (typeof req === 'string') req = fetch(req, options)
                    return await WebAssembly.instantiateStreaming(req)
                }
            },
            idleCallback: {//keep
                enumerable: true, value: async function (cb, timeout) {
                    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 0))
                    return idle(cb, { timeout })
                }
            },
            processError: {//keep
                enumerable: true, value: function (name, message, element, cause, detail = {}) {
                    detail = { ...detail, ...{ name, message, element, cause } }
                    if (element) element.dispatchEvent(new CustomEvent(`${name}Error`, { detail }))
                    let errors = element?.errors ?? this.env.options.errors
                    if (errors === 'throw') { throw new Error(message, { cause: detail }); return } else if (errors === 'hide') { return }
                }
            },
            resolveForElement: {//discard candidate
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
            resolveMeta: {//re-check - only used in legacy custom element tag resolution
                enumerable: true, value: function (element, is, name) {
                    let metaElement
                    const rootNode = element.shadowRoot || element.getRootNode()
                    return name ? rootNode.querySelector(`meta[is="${is}"][name="${name}"]`) : rootNode.querySelector(`meta[is="${is}"]`)
                }
            },
            resolveScope: {//keep
                enumerable: true, value: function (scopeStatement, element) {
                    if (!scopeStatement) return element.parentElement
                    let scope
                    if (scopeStatement === '$') {
                        scope = element
                    } else if (scopeStatement === ':') {
                        const root = element.getRootNode()
                        scope = (root instanceof ShadowRoot) ? root : document.body
                    } else if (scopeStatement === '~') {
                        const root = element.getRootNode()
                        scope = (root instanceof ShadowRoot) ? root : document.head
                    } else if (scopeStatement === '*') {
                        scope = element.getRootNode()
                        if (scope === document) scope = document.documentElement
                    } else if (scopeStatement.startsWith('#')) {
                        scope = document.documentElement
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
            resolveSelector: {//keep
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
            resolveScopedSelector: {//keep
                enumerable: true, value: function (scopedSelector, element) {
                    let scope = element, selector = scopedSelector
                    if (selector.startsWith('#')) selector = `:document|${selector}`
                    if (selector.includes('|')) {
                        const [scopeStatement, selectorStatement] = selector.split('|').map(s => s.trim())
                        scope = this.resolveScope(scopeStatement, element)
                        selector = selectorStatement
                    }
                    return this.resolveSelector(selector, scope)
                }
            },
            safeGet: {//keep
                enumerable: true, value: function (element, privateValue, attrName, propName) {
                    propName ||= attrName
                    const attr = element.getAttribute(attrName)
                    if (privateValue !== attr) {
                        element[propName] = attr
                        return attr
                    } else { return privateValue }
                }
            },
            sliceAndStep: {//keep
                enumerable: true, value: function (sig, list) {
                    let [start = 0, end = list.length, step = 0] = sig.split(':').map(s => (parseInt(s) || 0))
                    if (end === 0) end = list.length
                    list = list.slice(start, end)
                    if (!step) return list
                    return (step === 1) ? list.filter((v, i) => (i + 1) % 2) : list.filter((v, i) => (i + 1) % step === 0)
                }
            },
            wait: {//keep
                enumerable: true, value: async function (ms) {
                    return new Promise((resolve) => setTimeout(resolve, ms))
                }
            },
            waitUntil: {//keep
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
                if (this._globalNamespace) return
                Object.defineProperty(this, '_globalNamespace', { value: crypto.randomUUID() })
                Object.defineProperty(window, this._globalNamespace, { value: ElementHTML })
                this.env.ElementHTML = this
                Object.freeze(this.env)
                Object.freeze(this.env.gateways)
                Object.freeze(this.env.sources)
                this.encapsulateNative()
            }
            rootElement && await this.activateTag(this.utils.getCustomTag(rootElement), rootElement)
            if (rootElement && !rootElement.shadowRoot) return
            const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
                observerRoot = rootElement || this
            for (const element of domTraverser.call(domRoot, '*')) if (this.utils.getCustomTag(element)) this.load(element)
            observerRoot._observer ||= new MutationObserver(async records => {
                for (const record of records) for (const addedNode of (record.addedNodes || [])) {
                    if (this.utils.getCustomTag(addedNode)) this.load(addedNode)
                    if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.utils.getCustomTag(n)) this.load(n)
                }
            })
            observerRoot._observer.observe(domRoot, { subtree: true, childList: true })
        }
    },

    Expose: {
        enumerable: true, value: function (name = 'E') {
            if (!(name && typeof name === 'string')) name = 'E'
            window[name] ||= this
            this.env.errors = true
        }
    },
    ImportPackage: {
        enumerable: true, value: async function (packageObject) {
            let packageContents = packageObject?.default ?? {}
            if (!packageContents) return
            if ((typeof packageObject.loader === 'function')) packageContents = await packageObject.loader(packageObject.bootstrap ?? {})
            for (const a of Object.keys(this.env)) {
                if (packageContents[a] instanceof Object) {
                    Object.assign(this.env[a], packageContents[a])
                } else {
                    this.env[a] = packageContents[a]
                }
            }
        }
    },

    applyData: {
        enumerable: true, value: async function (element, data) {
            if (!(element instanceof HTMLElement)) return
            if (data === null) return
            const tag = (element.getAttribute('is') || element.tagName).toLowerCase()
            if (typeof data !== 'object') {
                switch (tag) {
                    case 'meta':
                        return data == undefined ? element.removeAttribute('content') : element.setAttribute('content', data)
                    case 'data': case 'meter': case 'input': case 'select': case 'textarea':
                        return element.value = data
                    case 'audio': case 'embed': case 'iframe': case 'img': case 'source': case 'track': case 'video':
                        return data == undefined ? element.removeAttribute('src') : element.setAttribute('src', data)
                    case 'area': case 'link':
                        return data == undefined ? element.removeAttribute('href') : element.setAttribute('href', data)
                    case 'object':
                        return data == undefined ? element.removeAttribute('data') : element.setAttribute('data', data)
                    default:
                        if (typeof data === 'string') return element[data.includes('<') && data.includes('>') ? 'innerHTML' : 'textContent'] = data
                        return element.textContent = (data == undefined) ? '' : data
                }
            }
            const setProperty = (k, v, element) => {
                if (k.includes('(') && k.endsWith(')')) {
                    return v != undefined ? this.runElementMethod(k, v, element) : undefined
                } else if (v === undefined) {
                    return delete element[k]
                }
                element[k] = v
            }
            for (const [k, v] of Object.entries(data)) {
                if (!k) continue
                switch (k[0]) {
                    case '#':
                        if (k === '#') element.setAttribute('id', v)
                        continue
                    case '&':
                        const className = k.slice(1)
                        if (!className) continue
                        element.classList.toggle(className, v)
                        continue
                    case '^':
                        const styleRule = k.slice(1)
                        if (!styleRule) continue
                        element.style[v === null ? 'removeProperty' : 'setProperty'](styleRule, v)
                        continue
                    case '@':
                        const kSlice1 = k.slice(1)
                        switch (v) {
                            case true: case false:
                                element.toggleAttribute(kSlice1, v)
                                continue
                            case null:
                                element.removeAttribute(kSlice1)
                                continue
                            default:
                                element.setAttribute(kSlice1, v)
                                continue
                        }
                    case '!':
                        let eventName = k.slice(1)
                        if (!eventName) eventName = this.sys.defaultEventTypes[tag] ?? 'click'
                        v === null ? element.addEventListener(eventName, event => event.preventDefault(), { once: true }) : element.dispatchEvent(new CustomEvent(eventName, { detail: v }))
                        continue
                    case '.':
                    case '<':
                        if (!v) { element.replaceChildren(); continue }
                        switch (k) {
                            case '<>':
                                element.innerHTML = v
                                continue
                            case '.':
                                element[v.includes('<') && v.includes('>') ? 'innerHTML' : 'textContent'] = v
                                continue
                            case '..':
                                element.textContent = v
                                continue
                            case '...':
                                element.innerText = v
                                continue
                            default:
                                if (k[0] === '<' && k.slice(-1) === '>') {
                                    const posMap = { '?++': 'after', '?--': 'before', '?-': 'prepend', '?+': 'append', '?**': 'replaceWith', '?*': 'replaceChildren' }
                                    let renderExpression = k.slice(1, -1), insertSelector,
                                        posMatch = renderExpression.match(new RegExp((Object.keys(posMap).map(s => `( \\${s.split('').join('\\')} )`).join('|')), 'gi'))
                                    if (posMatch) [renderExpression, insertSelector] = renderExpression.split(posMatch).map(s => s.trim())
                                    if (renderExpression[0] === '%' && renderExpression.slice(-1) === '%') {
                                        const useTemplate = this.utils.resolveScopedSelector(renderExpression.slice(1, -1), element)
                                        if (useTemplate) this.applyDataWithTemplate(element, v, useTemplate, posMap[(posMatch ?? '').trim()], insertSelector)
                                        continue
                                    }
                                    const tagMatch = renderExpression.match(this.sys.regexp.tagMatch) ?? [],
                                        idMatch = renderExpression.match(this.sys.regexp.idMatch) ?? [], classMatch = renderExpression.match(this.sys.regexp.classMatch) ?? [],
                                        attrMatch = renderExpression.match(this.sys.regexp.attrMatch) ?? []
                                    this.applyDataWithTemplate(element, v, tagMatch[0], posMap[(posMatch ?? '').trim()], insertSelector, (idMatch[0] ?? '').slice(1),
                                        (classMatch[0] ?? '').slice(1).split('.').map(s => s.trim()).filter(s => !!s),
                                        Object.fromEntries((attrMatch ?? []).map(m => m.slice(1, -1)).map(m => m.split('=').map(ss => ss.trim())))
                                    )
                                    continue
                                }
                                setProperty(k.slice(1), v, element)
                        }
                    case '`':
                        let nestingTargets = this.utils.resolveScopedSelector(k.slice(1, -1), element)
                        if (!Array.isArray(nestingTargets)) nestingTargets = [nestingTargets]
                        await Promise.all(nestingTargets.map(t => this.applyData(t, v)))
                        continue
                    case '~':
                        this.env.variables[k.slice(1)] = v
                        continue
                    default:
                        setProperty(k, v, element)
                }
            }
        },
    },

    applyDataWithTemplate: {//keep
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

    runElementMethod: {//keep
        enumerable: true, value: function (statement, arg, element) {
            let [funcName, ...argsRest] = statement.split('(')
            if (typeof element[funcName] === 'function') {
                argsRest = argsRest.join('(').slice(0, -1)
                argsRest = argsRest ? argsRest.split(',').map(a => this.getVariable(a.trim(), a.trim(), {}, { context: {} })) : []
                return element[funcName](...argsRest, ...(Array.isArray(arg) ? arg : [arg]))
            }
        }
    },

    parse: {//keep
        enumerable: true, value: async function (input, sourceElement, contentType) {
            const typeCheck = (input instanceof Response) || (typeof input === 'text')
            if (!typeCheck && (input instanceof Object)) return input
            input = typeCheck ? input : `${input}`
            if (!contentType) {
                contentType = sourceElement
                    ? (sourceElement.getAttribute('content-type') || (sourceElement.optionsMap ?? {})['Content-Type'] || sourceElement._contentType || undefined) : undefined
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
            if (contentType.includes('application/json')) return (input instanceof Response) ? await input.json() : JSON.parse(input)
            let text = ((input instanceof Response) ? await input.text() : input).trim()
            if (contentType === 'text/md') {
                this.env.helpers.md ||= await this.installMdDefaultHelper()
                return this.env.helpers.md(text, 'parse', this)
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
    serialize: {//keep
        enumerable: true, value: async function (input, sourceElement, contentType) {
            if (typeof input === 'string') return input
            contentType ||= sourceElement
                ? sourceElement.getAttribute('content-type') || (sourceElement?.optionsMap ?? {})['Content-Type'] || sourceElement?._contentType || 'application/json' : undefined
            if (contentType && !contentType.includes('/')) contentType = `application/${contentType}`
            if (contentType === 'application/json') return JSON.stringify(input)
            if (contentType === 'text/html' || contentType === 'text/md') {
                if (!(input instanceof Node)) return
                let text = input?.outerHTML ?? input.textContent
                if (contentType === 'text/md') {
                    this.env.helpers.md ||= await this.installMdDefaultHelper()
                    return this.env.helpers.md(text, 'serialize', this)
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

    flatten: {//keep
        enumerable: true, value: function (value, key, event) {
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
                        'selected', 'slot', 'tagName', 'title'], []))),
                    innerHTML, textContent, innerText, style, classList, tag: (value.getAttribute('is') || value.tagName).toLowerCase(),
                    '.': (textContent.includes('<') && textContent.includes('>')) ? innerHTML : textContent,
                    '..': textContent, '...': innerText, '<>': innerHTML, '#': value.id
                }
                if ('id' in value) result.id = value.id
                if ('name' in value) result.name = value.name
                if ('value' in value) result.value = value.value
                if ('checked' in value) result.checked = value.checked
                if ('selected' in value) result.selected = value.selected
                for (const c of Object.keys(classList)) result[`&${c}`] = true
                for (const ent of Object.entries(style)) result[`^${ent[0]}`] = ent[1]
                if (value.constructor._flattenableProperties && Array.isArray(value.constructor._flattenableProperties)) {
                    for (const p of value.constructor._flattenableProperties) result[p] = value[p]
                }
                result._named = {}
                for (const c of value.querySelectorAll('[name]')) result._named[c.getAttribute('name')] ||= this.flatten(c)._
                result._itemprop = {}
                for (const c of value.querySelectorAll('[itemprop]')) result._itemprop[c.getAttribute('itemprop')] ||= this.flatten(c)._
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
                if (result.tag === 'form' || result.tag === 'fieldset') {
                    result._ = result._named
                } else if (result.tag === 'table') {
                    result._ = result._rows
                } else if (['data', 'meter', 'input', 'select', 'textarea'].includes(result.tag)) {
                    if (result.tag === 'input') {
                        const type = value.getAttribute('type')
                        if (type === 'checkbox') {
                            result._ = value.checked
                        } else if (type === 'radio') {
                            result._ = value.selected
                        } else { result._ = value.value }
                    } else {
                        result._ = value.value
                    }
                } else if (result.tag === 'time') {
                    result._ = value.getAttribute('datetime')
                } else if (result.tag === 'meta' && !value.hasAttribute('is')) {
                    result._ = value.getAttribute('content')
                } else if (value.hasAttribute('itemscope')) {
                    result._ = result._itemprop
                } else {
                    result._ = innerText.trim()
                }
                if (result.tag === 'select' || result.tag === 'datalist') {
                    const options = Array.from(value.querySelectorAll('option')), isObj = options.some(opt => opt.hasAttribute('value'))
                    for (const opt of options) result._options.push(isObj ? [opt.getAttribute('value'), opt.textContent.trim()] : opt.textContent.trim())
                    if (isObj) result._options = Object.fromEntries(result._options)
                    if (result.tag === 'datalist') result._ = result._options
                }
                result._closest = {
                    id: value.closest('[id]')?.id,
                    name: value.closest('[name]')?.name,
                    class: value.closest('[class]')?.getAttribute('class'),
                }
                if (event instanceof Event) result._event = this.flatten(event)
            } else if (value instanceof Event) {
                //console.log('line 834', value)
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
            } else if (value instanceof Request) {
                // something
            } else if (value instanceof Response) {
                return {
                    _: this.E.parse(value),
                    ok: value.ok,
                    status: value.status,
                    headers: Object.fromEntries(value.headers.entries())
                }
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

    mdDefaultHelper: {
        enumerable: true, value: function (text, direction = 'parse') {
            if (!this.env.libraries.md) return
            const htmlBlocks = (text.match(this.sys.regexp.htmlBlocks) ?? []).map(b => [crypto.randomUUID(), b]),
                htmlSpans = (text.match(this.sys.regexp.htmlSpans) ?? []).map(b => [crypto.randomUUID(), b])
            for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
            for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
            text = this.env.libraries.md.render(text)
            for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
            for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
            return text
        }
    },
    installMdDefaultHelper: {
        enumerable: true, value: async function (label, importName, doNew, src) {
            this.env.libraries.md ||= new (await import('https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm')).Remarkable
            const plugin = md => md.core.ruler.push('html-components', parser(md, {}), { alt: [] }),
                parser = md => {
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
            this.env.libraries.md.use(plugin)
            this.env.libraries.md.set(this.env.options.md)
            return this.mdDefaultHelper.bind(this)
        }
    },








    getCell: {//keep
        enumerable: true, value: function (name) {
            if (!name) return
            const cells = this.env.cells
            if (!cells[name]) {
                const cell = {
                    type: 'cell',
                    channel: new BroadcastChannel(name),
                    eventTarget: new EventTarget(),
                    get: function () { return this.value },
                    set: function (value, labelMode) {
                        let isSame = this.value === value
                        if (!isSame) try { isSame = JSON.stringify(this.value) === JSON.stringify(value) } catch (e) { }
                        if (isSame) {
                            if (labelMode === 'force') cell.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                            return
                        }
                        this.channel.postMessage(value)
                        this.value = value
                        if (labelMode !== 'silent') cell.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                        return this
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


    getFieldOrCellGroup: {//keep
        enumerable: true, value: function (expression, type = '#', element) {
            let group
            const getFieldOrCellTarget = (name) => {
                const modeFlag = name[name.length - 1],
                    mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
                if (mode) name = name.slice(0, -1).trim()
                if (name[0] === '#') {
                    return [this.getCell(name.slice(1)), mode]
                } else if (name[0] === '%') {
                    return [element.getField(name.slice(1)), mode]
                } else {
                    return [type === '%' ? element.getField(name) : this.getCell(name), mode]
                }
            }
            if ((expression[0] === '{') && expression.endsWith('}')) {
                group = {}
                for (const pair of expression.slice(1, -1).trim().split(',')) {
                    let [key, name] = pair.trim().split(':').map(s => s.trim())
                    if (!name) name = key
                    const keyEndsWith = key[key.length - 1]
                    if (keyEndsWith === '!' || keyEndsWith === '?') key = key.slice(0, -1)
                    group[key] = getFieldOrCellTarget(name)
                }
            } else if ((expression[0] === '[') && expression.endsWith(']')) {
                group = []
                for (let t of expression.slice(1, -1).split(',')) {
                    t = t.trim()
                    if (!t) continue
                    group.push(getFieldOrCellTarget(t))
                }
            } else {
                expression = expression.trim()
                if (!expression) return
                group = [getFieldOrCellTarget(expression)]
            }
            return group
        }
    },

    getVariable: {//keep
        enumerable: true, value: function (expression, value, labels, env) {
            if (!expression) return value
            const isNumeric = /^[0-9\.]+$/
            switch (expression[0]) {
                case '"':
                case "'":
                    return expression.slice(1, -1)
                case '{':
                    if (expression.endsWith('}')) {
                        const items = {}
                        for (let pair of expression.slice(1, -1).split(',')) {
                            if (!(pair = pair.trim())) continue
                            let [key, name] = pair.split(':')
                            if (!(key = key.trim()) || !(name = name.trim())) continue
                            key = this.getVariable(key, value, labels, env)
                            if (!key || (typeof key !== 'string')) continue
                            items[key] = this.getVariable(name, value, labels, env)
                        }
                        return items
                    } else {
                        return expression
                    }
                    break
                case '[':
                    if (expression.endsWith(']')) {
                        const items = []
                        for (const item of expression.slice(1, -1).split(',')) items.push(this.getVariable(item.trim(), value, labels, env))
                        return items
                    } else {
                        return expression
                    }
                    break
                case 't':
                case 'f':
                case 'n':
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    if (expression === 'null' || expression === 'true' || expression === 'false'
                        || expression.match(isNumeric)) {
                        return JSON.parse(expression)
                    } else {
                        return labels[expression] ?? expression
                    }
                    break
                case '~':
                    return env.context[expression.slice(1)]
                case '#':
                    return (env.cells[expression.slice(1)] ?? {})?.get()
                case '%':
                    return (env.fields[expression.slice(1)] ?? {})?.get()
                case '$':
                    expression = expression.slice(1)
                    if (!expression) return value
                    return labels[expression] ?? (env.fields[expression] ?? {})?.get() ?? (env.cells[expression] ?? {})?.get() ?? env.context[expression]
                default:
                    return labels[expression] ?? expression
            }
        }
    },

    mergeVariables: {//keep
        enumerable: true, value: function (expression, value, labels, env, inner) {
            if (!expression) return inner ? value : undefined
            if (typeof expression !== 'string') return expression
            const regExp = /\$\{(.*?)\}/g, isMatch = expression.match(regExp)
            if (!isMatch && !inner) return expression
            if (!isMatch && inner) {
                return this.getVariable(expression, value, labels, env)
            } else if (expression[0] === '[' && expression.endsWith(']')) {
                return expression.slice(1, -1).split(',').map(s => this.mergeVariables(s.trim(), value, labels, env, true))
            } else if (expression[0] === '{' && expression.endsWith('}')) {
                return Object.fromEntries(expression.slice(1, -1).split(',').map(s => {
                    const [k, v] = s.trim().split(':').map(ss => s.trim())
                    return [k, this.mergeVariables(v, value, labels, env, true)]
                }))
            }
            const merge = (exp) => {
                if (exp) exp = exp.slice(2, -1)
                return this.mergeVariables(exp, value, labels, env, true)
            }
            return ((isMatch.length === 1) && (isMatch[0] === expression)) ? merge(expression) : expression.replace(regExp, merge)
        }
    },






    resolveUrl: {//keep
        enumerable: true, value: function (value, element) {
            if (typeof value !== 'string') return value
            if (value.startsWith('https://') || value.startsWith('http://')) return value
            if (value.includes('://')) {
                const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
                return typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath, this) : value
            }
            return new URL(value, document.baseURI).href
        }
    },

    runTransform: {//keep
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
                this.env.libraries.jsonata ||= (await import('https://cdn.jsdelivr.net/npm/jsonata@2.0.3/+esm')).default
                this.env.transforms[transformKey] ||= [transform, this.env.libraries.jsonata(transform)]
                expression ||= this.env.transforms[transformKey][1]
                const bindings = {}

                if (transform.includes('$console(')) bindings.console = (...m) => console.log(...m)
                if (transform.includes('$uuid()')) bindings.uuid = () => crypto.randomUUID()
                if (transform.includes('$form(')) bindings.form = v => (v instanceof Object) ? Object.fromEntries(Object.entries(v).map(ent => ['`' + `[name="${ent[0]}"]` + '`', ent[1]])) : {}
                if (transform.includes('$queryString(')) bindings.queryString = v => (v instanceof Object) ? (new URLSearchParams(Object.fromEntries(Object.entries(v).filter(ent => ent[1] != undefined)))).toString() : ""

                if (transform.includes('$is(')) {
                    bindings.is = (schemaName, data) => {
                        const schemaHandler = this.env.schemas[schemaName]
                        if (typeof schemaHandler !== 'function') return false
                        const [valid, errors] = schemaHandler(data)
                        return { valid, errors }
                    }
                }

                if (transform.includes('$markdown2Html(')) {
                    this.env.helpers.md ||= await this.installMdDefaultHelper()
                    bindings.markdown2Html = text => this.env.helpers.md(text)
                }

                if (element && transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.utils.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)

                if (element && transform.includes('$this')) bindings.this = this.flatten(element)
                if (element && transform.includes('$root')) bindings.root = this.flatten(element.getRootNode())
                if (element && transform.includes('$host')) bindings.host = this.flatten(element.getRootNode().host)
                const nearby = ['parentElement', 'firstElementChild', 'lastElementChild', 'nextElementSibling', 'previousElementSibling']
                for (const p of nearby) if (element && transform.includes(`$${p}`)) bindings[p] = this.flatten(element[p])

                for (const [k, v] of Object.entries(variableMap)) if (transform.includes(`$${k}`)) bindings[k] = typeof v === 'function' ? v : this.flatten(v)

                const result = await expression.evaluate(data, bindings)
                return result
            } catch (e) {
                console.log('line 1265', e, transform, data, element)
                const errors = element?.errors ?? this.env.options.errors
                if (element) element.dispatchEvent(new CustomEvent('error', { detail: { type: 'runTransform', message: e, input: { transform, data, variableMap } } }))
                if (errors === 'throw') { throw new Error(e); return } else if (errors === 'hide') { return }
            }
        }
    },
    sortByInheritance: {//keep
        enumerable: true, value: function (idList) {
            return Array.from(new Set(idList)).filter(t => this.extends[t]).sort((a, b) =>
                ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
                .map((v, i, a) => (i === a.length - 1) ? [v, this.extends[v]] : v).flat()
        }
    },

    classes: { value: {} },//keep
    constructors: { value: {} },//keep
    extends: { value: {} },//keep
    files: { value: {} },//keep
    ids: { value: {} },//keep
    _observer: { enumerable: false, writable: true, value: undefined },
    scripts: { value: {} },//keep
    styles: { value: {} },//keep
    _styles: { value: {} },
    tags: { value: {} },//keep
    templates: { value: {} },//keep
    _templates: { value: {} },

    activateTag: {//keep
        value: async function (tag, element, forceReload = false) {
            if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
            const id = this.getTagId(tag);
            [this.ids[tag], this.tags[id]] = [id, tag]
            const loadResult = await this.loadTagAssetsFromId(id, forceReload)
            if (!loadResult) return
            const baseTag = this.getInheritance(id).pop() || 'HTMLElement'
            if (!globalThis.customElements.get(tag)) globalThis.customElements.define(tag, this.constructors[id], (baseTag && baseTag !== 'HTMLElement' & !baseTag.includes('-')) ? { extends: baseTag } : undefined)
        }
    },
    encapsulateNative: {//keep
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
        value: function (tag) {
            if (this.ids[tag]) return this.ids[tag]
            const [namespace, pointer] = tag.split('-', 2).map(t => t.toLowerCase())
            if (namespace === 'e') return (new URL(`./e/element/${pointer}.html`, import.meta.url)).href
            if (!this.env.namespaces[namespace]) return
            return (new URL(`${this.env.namespaces[namespace]}/${pointer}.html`, document.baseURI)).href
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
            const ElementHTML = this
            let extendsId = this.scripts[id].match(this.sys.regexp.extends)?.groups?.extends || 'HTMLElement'
            if (extendsId.startsWith('e-')) {
                extendsId = this.getTagId(extendsId)
            } else if (extendsId.includes('/')) {
                if (!extendsId.startsWith('https://') && !extendsId.startsWith('https://')) extendsId = new URL(extendsId, id).href
                if (!extendsId.endsWith('.html')) extendsId += '.html'
            }
            this.extends[id] = extendsId
            this.files[extendsId] || !extendsId.includes('/') || await this.loadTagAssetsFromId(extendsId)
            if (!this.files[extendsId] && extendsId.includes('/')) return
            const sanitizedScript = this.scripts[id].replace(this.sys.regexp.extends, `class extends ElementHTML.constructors['${extendsId}'] {`),
                sanitizedScriptAsModule = `const ElementHTML = globalThis['${this._globalNamespace}']; export default ${sanitizedScript}`,
                sanitizedScriptAsUrl = URL.createObjectURL(new Blob([sanitizedScriptAsModule], { type: 'text/javascript' })),
                classModule = await import(sanitizedScriptAsUrl)
            URL.revokeObjectURL(sanitizedScriptAsUrl)
            this.classes[id] = classModule.default
            this.classes[id].id = id
            this.constructors[id] = class extends this.classes[id] { constructor() { super() } }
            return true
        }
    },
    stackStyles: {//keep
        value: function (id) {
            if (typeof this._styles[id] === 'string') return this._styles[id]
            this._styles[id] = this.getInheritance(id).reverse().filter(id => this.styles[id]).map(id => `/** styles from '${id}' */\n` + this.styles[id]).join("\n\n")
            return this._styles[id]
        }
    },
    stackTemplates: {//keep
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

    _dispatchPropertyEvent: {//re-check
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
                    Object.defineProperties($this, {
                        E: { enumerable: false, value: ElementHTML },//keep
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
                static get _flattenableProperties() { return this.observedAttributes }
                static E = ElementHTML
                async connectedCallback() { this.dispatchEvent(new CustomEvent('connected')) }
                async readyCallback() { }
                attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
                valueOf() { return this.E.flatten(this) }
            }
        }
    }
})

const metaUrl = new URL(import.meta.url), metaOptions = metaUrl.searchParams
if (metaOptions.has('packages')) {
    const importmapElement = document.head.querySelector('script[type="importmap]')
    let importmap = { imports: {} }
    if (importmapElement) try { importmap = JSON.parse(importmapElement.textContent.trim()) } catch (e) { }
    const imports = importmap.imports ?? {}, importPromises = []
    for (const p of metaOptions.get('packages').split(',').map(s => s.trim())) {
        if (!p) continue
        if ((typeof imports[p] === 'string') && imports[p].includes('/')) importPromises.push(import(ElementHTML.resolveUrl(imports[p])))
    }
    await Promise.all(importPromises)
    for (const p of importPromises) await ElementHTML.ImportPackage(p)
}
if (metaOptions.has('expose')) ElementHTML.Expose(metaOptions.get('expose'))
if (metaOptions.has('load')) await ElementHTML.load()

export { ElementHTML }