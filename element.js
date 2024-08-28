const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '2.0.0' },

    env: {
        enumerable: true, value: {
            components: {},
            context: {},
            facets: {},
            helpers: {
                'application/schema+json': function (value, typeName) {
                    if (!this.app.types[typeName]) return
                    let valid = this.app.types[typeName].validate(value), errors = valid ? undefined : this.app.types[typeName].errors(value)
                    return { valid, errors }
                },
                'application/x-jsonata': function (text) {
                    let expression = this.app.libraries['application/x-jsonata'](text)
                    if (text.includes('$console(')) expression.registerFunction('console', (...m) => console.log(...m))
                    if (text.includes('$uuid()')) expression.registerFunction('uuid', () => crypto.randomUUID())
                    if (text.includes('$form(')) expression.registerFunction('form',
                        v => (v instanceof Object) ? Object.fromEntries(Object.entries(v).map(ent => ['`' + `[name="${ent[0]}"]` + '`', ent[1]])) : {})
                    if (text.includes('$queryString(')) expression.registerFunction('queryString',
                        v => (v instanceof Object) ? (new URLSearchParams(Object.fromEntries(Object.entries(v).filter(ent => ent[1] != undefined)))).toString() : "")
                    for (const [helperAlias, helperName] of Object.entries(this.env.options['application/x-jsonata']?.helpers ?? {})) if (text.includes(`$${helperAlias}(`))
                        expression.registerFunction(helperAlias, (...args) => this.useHelper(helperName, ...args))
                    return expression
                },
                'xdr': function (operation, ...args) { return this.app.libraries.xdr[operation](...args) },
                'ipfs://': function (hostpath) {
                    const [cid, ...path] = hostpath.split('/'), gateway = this.env.options['ipfs://']?.gateway ?? 'dweb.link'
                    return `https://${cid}.ipfs.${gateway}/${path.join('/')}}`
                },
                'ipns://': function (hostpath) {
                    const [cid, ...path] = hostpath.split('/'), gateway = this.env.options['ipns://']?.gateway ?? 'dweb.link'
                    return `https://${cid}.ipns.${gateway}/${path.join('/')}}`
                },
                'text/markdown': function (text, serialize) {
                    if (!this.app.libraries['text/markdown']) return
                    const htmlBlocks = (text.match(this.sys.regexp.htmlBlocks) ?? []).map(b => [crypto.randomUUID(), b]),
                        htmlSpans = (text.match(this.sys.regexp.htmlSpans) ?? []).map(b => [crypto.randomUUID(), b])
                    for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
                    for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
                    text = this.app.libraries['text/markdown'].render(text)
                    for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
                    for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
                    return text
                }
            },
            loaders: {
                'application/schema+json': async function () {
                    this.app.libraries['application/schema+json'] = (await import('https://cdn.jsdelivr.net/npm/jema.js@1.1.7/schema.min.js')).Schema
                    await Promise.all(Object.entries(this.env.types).map(async entry => {
                        let [typeName, typeSchema] = entry
                        if (typeof typeSchema === 'string') typeSchema = await fetch(typeSchema).then(r => r.json())
                        this.app.types[typeName] = new this.app.libraries['application/schema+json'](typeSchema)
                        await this.app.types[typeName].deref()
                    }))
                },
                'application/x-jsonata': async function () {
                    this.app.libraries['application/x-jsonata'] = (await import('https://cdn.jsdelivr.net/npm/jsonata@2.0.3/+esm')).default
                },
                'xdr': async function () { this.app.libraries.xdr = (await import('https://cdn.jsdelivr.net/gh/cloudouble/simple-xdr/xdr.min.js')).default },
                'ipfs://': async function () {
                    if (this.env.options['ipfs://']?.gateway) return
                    try {
                        if ((await fetch('https://ipfs.tech.ipns.localhost:8080/', { method: 'HEAD' })).ok) {
                            this.env.options['ipfs://'] ||= {}
                            this.env.options['ipfs://'].gateway ||= 'localhost:8080'
                            this.env.options['ipns://'] ||= {}
                            this.env.options['ipns://'].gateway ||= 'localhost:8080'
                        }
                    } catch (e) { }
                },
                'ipns://': async function () {
                    if (this.env.options['ipns://']?.gateway) return
                    if (typeof this.env.loaders['ipfs://'] === 'function') return await this.env.loaders['ipfs://']()
                },
                'text/markdown': async function () {
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
            },
            namespaces: { e: (new URL(`./components`, import.meta.url)).href },
            options: { 'application/x-jsonata': { helpers: { is: 'application/schema+json' } } }, regexp: {}, snippets: {}, transforms: {}, types: {}
        }
    },

    Compile: {
        enumerable: true, value: async function (protocols) {
            this.app.compile = true
            await this.installModule('compile')
            protocols = (protocols || '').split(',').map(s => s.trim()).filter(s => !!s).map(p => `${p}://`)
            for (let p of protocols) {
                this.env.loaders[p] &&= this.env.loaders[p].bind(this)
                this.env.helpers[p] &&= this.env.helpers[p].bind(this)
                await this.loadHelper(p)
            }
        }
    },
    Dev: {
        enumerable: true, value: async function () {
            this.app.dev = true
            this.app.facets.exports = new WeakMap()
            this.app.packages = new Map()
            this.app.archives = new Map()
            this.app.archives.set('options', JSON.parse(JSON.stringify(this.env.options)))
            await this.installModule('dev')
        }
    },
    Expose: {
        enumerable: true, value: async function (name = 'E') {
            this.app.expose = true
            globalThis[name && typeof name === 'string' ? name : 'E'] ||= this
        }
    },
    ImportPackage: {
        enumerable: true, value: async function (packageObject, packageUrl, packageKey) {
            let pkg = packageObject?.default ?? {}
            if (!this.isPlainObject(pkg)) return
            for (const scope in pkg) if (typeof pkg[scope] === 'string') pkg[scope] = await this.getExports(this.resolveUrl(pkg[scope], packageUrl))
            if (pkg?.hooks?.preInstall === 'function') pkg = await (pkg.hooks.preInstall.bind(pkg))(this)
            for (const scope in pkg) if (scope in this.env) {
                const pkgScope = pkg[scope], envScope = this.env[scope]
                if (this.app.dev) {
                    if (!this.app.archives.has(scope)) this.app.archives.set(scope, new Map())
                    if (!this.app.packages.has(scope)) this.app.packages.set(scope, new Map())
                    for (const i in pkgScope) {
                        if (scope === 'hooks') continue
                        this.app.archives.get(scope).set(i, pkgScope[i])
                        this.app.packages.get(scope).set(i, packageKey)
                    }
                }
                switch (scope) {
                    case 'components':
                        const componentNamespaceBase = (new URL('../components', packageUrl)).href,
                            namespaceExists = Object.values({ ...this.env.namespaces, ...(pkg.namespaces ?? {}) }).includes(componentNamespaceBase)
                        if (!namespaceExists) this.env.namespaces[packageKey] = componentNamespaceBase
                        for (const componentKey in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[componentKey], scope), componentId = `${componentNamespaceBase}/${componentKey}.html`
                            envScope[componentId] = await this.componentFactory(importItem, componentId)
                            if (this.app.dev) {
                                this.app.archives.get(scope).set(componentId, pkgScope[componentKey])
                                this.app.packages.get(scope).set(componentId, packageKey)
                                if (!this.app.archives.has('namespaces')) this.app.archives.set('namespaces', new Map())
                                if (!this.app.packages.has('namespaces')) this.app.packages.set('namespaces', new Map())
                                this.app.archives.get('namespaces').set(packageKey, componentNamespaceBase)
                                this.app.packages.get('namespaces').set(packageKey, packageKey)
                            }
                        }
                        break
                    case 'context': case 'options':
                        for (const s in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[s], scope)
                            try {
                                envScope[s] = JSON.parse(JSON.stringify(importItem))
                            } catch (e) { throw new Error(`Invalid package ${scope} item ${s} in ${packageKey}`) }
                        }
                        break
                    case 'facets':
                        for (const facetCid in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[facetCid], scope)
                            envScope[facetCid] = await this.facetFactory(importItem)
                        }
                        break
                    case 'helpers': case 'hooks': case 'loaders':
                        for (const f in pkgScope) if (typeof pkgScope[f] === 'function') {
                            if (scope === 'hooks') {
                                envScope[f] ??= []
                                let newHookIndex = envScope[f].push(pkgScope[f].bind(this)) - 1
                                if (this.app.dev) {
                                    if (!this.app.archives.get(scope).has(f)) this.app.archives.get(scope).set(f, [])
                                    if (!this.app.packages.get(scope).has(f)) this.app.packages.get(scope).set(f, [])
                                    this.app.archives.get(scope).get(f)[newHookIndex] = pkgScope[f]
                                    this.app.packages.get(scope).get(f)[newHookIndex] = packageKey
                                }
                            } else {
                                envScope[f] = pkgScope[f].bind(this)
                            }
                        }
                        break
                    case 'namespaces':
                        for (const n in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[n], scope)
                            envScope[n] = this.resolveUrl(importItem, packageUrl)
                            if (envScope[n].endsWith('/')) envScope[n] = envScope[n].slice(0, -1)
                        }
                        break
                    case 'regexp':
                        for (const r in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[r], scope)
                            envScope[r] = new RegExp(importItem)
                        }
                        break
                    case 'snippets':
                        for (const s in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[s], scope)
                            if (importItem instanceof HTMLElement) {
                                envScope[s] = importItem
                            } else if (typeof importItem === 'string') {
                                if (importItem[0] === '`' && importItem.slice(-1) === '`') {
                                    envScope[s] = ('`' + this.resolveUrl(this.resolveSnippetKey(importItem), packageUrl) + '`')
                                } else {
                                    const snippetInstance = document.createElement('template')
                                    snippetInstance.innerHTML = importItem
                                    envScope[s] = snippetInstance
                                }
                            }
                        }
                        break
                    case 'types':
                        for (const t in pkgScope) {
                            const importItem = await this.resolvePackageItem(pkgScope[t], scope)
                            if (importItem === undefined) continue
                            envScope[t] = importItem
                        }
                }
            }
            this.env.namespaces[packageKey] ||= `${this.resolveUrl('../', packageUrl)}components`
            if (pkg?.hooks?.postInstall === 'function') await (pkg.hooks.postInstall.bind(pkg))(this)
        }
    },
    Load: {
        enumerable: true, value: async function (rootElement = undefined, preload = []) {
            if (!rootElement) {
                for (const s in this.sys.selector) {
                    for (const ss in this.sys.selector[s]) if (typeof this.sys.selector[s][ss] === 'function') this.sys.selector[s][ss] = this.sys.selector[s][ss].bind(this)
                    Object.freeze(this.sys.selector[s])
                }
                Object.freeze(this.sys.selector)
                for (const c in this.sys.color) if (typeof this.sys.color[c] === 'function') this.sys.color[c] = this.sys.color[c].bind(this)
                Object.freeze(this.sys.color)
                for (const a in this.env) Object.freeze(this.env[a])
                Object.freeze(this.env)
                for (const f of ['binders', 'handlers', 'parsers']) {
                    if (!this[f]) continue
                    for (const b in this[f]) this[f][b] = this[f][b].bind(this)
                    Object.freeze(this[f])
                }
                if (this.app.dev) {
                    for (const f in Object.freeze(this.app.archives)) Object.freeze(this.app.archives[f])
                    for (const f in this.console) if (typeof this.console[f] === 'function') this.console[f] = this.console[f].bind(this)
                    Object.freeze(this.console)
                    for (const invoker in this.invokers) window[invoker] ??= this.invokers[invoker].bind(this)
                    Object.freeze(this.invokers)
                } else {
                    console.log = () => { }
                    globalThis.addEventListener('unhandledrejection', event => event.preventDefault())
                }
                Object.freeze(this)
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

    dispatchComponentEvent: {
        enumerable: true, value: function (instance, value, eventName, bubbles = true, cancelable = true, composed = false) {
            let virtualElement = this.app.components.virtuals.get(instance), nativeElement = this.app.components.natives.get(instance)
            const isPair = (virtualElement || nativeElement)
            if (isPair) {
                virtualElement ??= instance
                nativeElement ??= instance
                eventName ??= virtualElement.constructor.events?.default ?? this.sys.defaultEventTypes[nativeElement.tagName.toLowerCase()] ?? 'click'
                return virtualElement.dispatchEvent(new CustomEvent(eventName, { detail: value, bubbles, cancelable, composed }))
                    && nativeElement.dispatchEvent(new CustomEvent(eventName, { detail: value, bubbles, cancelable, composed }))
            }
            eventName ??= instance instanceof this.Component ? (instance.constructor.events?.default) : this.sys.defaultEventTypes[instance.tagName.toLowerCase()]
            return instance.dispatchEvent(new CustomEvent(eventName ?? 'click', { detail: value, bubbles, cancelable, composed }))
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
            if (value === undefined) return null
            if ((value == null) || (typeof value !== 'object')) return value
            if (Array.isArray(value)) return value.map(e => this.flatten(e, key))
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
            if (value instanceof Object) {
                let result = Object.fromEntries(Object.entries(value).filter(ent => typeof ent[1] !== 'function'))
                return key ? result[key] : result
            }
        }
    },
    getCell: {
        enumerable: true, value: function (name) {
            return this.getStateContainer(name)
        }
    },
    getField: {
        enumerable: true, value: function (facetInstanceOrContainer, fieldName) {
            return this.getStateContainer(fieldName, facetInstanceOrContainer)
        }
    },
    isFacetContainer: {
        enumerable: true, value: function (element) {
            return ((element instanceof HTMLScriptElement) && (element.type === 'directives/element' || element.type === 'facet/element' || element.type === 'application/element'))
        }
    },
    isPlainObject: {
        enumerable: true, value: async function (obj) {
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
    mergeVariables: {
        enumerable: true, value: function (expression, value, labels, env, inner) {
            if (!expression) return inner ? value : undefined
            if (typeof expression !== 'string') return expression
            if (expression === (inner ? '$' : '${$}')) return value
            const isMatch = expression.match(this.sys.regexp.hasVariable)
            labels ||= {}
            env ||= {}
            env.fields ||= {}
            env.cells ||= { ...this.app.cells }
            env.context ||= { ...this.env.context }
            if (!isMatch) return inner ? this.getVariable(expression, value, labels, env) : expression
            if (expression[0] === '[') return expression.slice(1, -1).split(',').map(s => this.mergeVariables(s.trim(), value, labels, env, true))
            if (expression[0] === '{') return Object.fromEntries(expression.slice(1, -1).split(',').map(s => {
                const [k, v] = s.trim().split(':').map(ss => s.trim())
                return [k, this.mergeVariables(v, value, labels, env, true)]
            }))
            const merge = (exp, canBeNotString) => {
                if (!inner) exp = exp.trim().slice(2, -1).trim()
                let retval
                if (exp.includes('.')) {
                    const fragments = exp.split('.').map(s => s.trim())
                    retval = this.mergeVariables(fragments.shift(), value, labels, env, true)
                    for (const frag of fragments) {
                        retval = (frag.endsWith(')') && frag.includes('(')) ? this.runFragmentAsMethod(frag, retval) : retval?.[frag]
                        if (retval == undefined) break
                    }
                } else {
                    retval = this.mergeVariables(exp, value, labels, env, true)
                }
                if (typeof retval === 'string') return retval
                if (typeof retval === 'function') retval = undefined
                if (canBeNotString) return retval
                try { return retval === undefined ? '' : JSON.stringify(retval) } catch (e) { return undefined }
            }
            return ((isMatch.length === 1) && (isMatch[0] === expression)) ? merge(expression, true) : expression.replace(this.sys.regexp.hasVariable, merge)
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
            element = this.app.components.natives.get(element) ?? element
            if (this.sys.impliedScopes[scopedSelector]) return this.resolveScope(this.sys.impliedScopes[scopedSelector], element)
            if (this.sys.impliedScopes[scopedSelector[0]]) scopedSelector = `${this.sys.impliedScopes[scopedSelector[0]]}|${scopedSelector}`
            let scope = element
            if (this.sys.regexp.pipeSplitter.test(scopedSelector)) {
                const [scopeStatement, selectorStatement] = scopedSelector.split(this.sys.regexp.pipeSplitter, 2).map(s => s.trim())
                scope = this.resolveScope(scopeStatement, element)
                scopedSelector = selectorStatement
            }
            return this.resolveSelector(scopedSelector, scope)
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
    resolveVariables: {
        enumerable: true, value: function (expression, flags, lexicon = {}) {
            let result = expression, { inner, default: dft, spread } = (flags ?? {})
            switch (true) {
                case typeof value === 'string':
                    expression = expression.trim()
                    inner ??= !((expression[0] === '$') && (expression[1] === '{') && (expression.endsWith('}')))
                    if (inner) expression = expression.slice(2, -1).trim()
                    const { context, cells, fields, labels, value } = lexicon
                    switch (true) {
                        case (expression in this.sys.valueAliases):
                            result = this.sys.valueAliases[expression]
                            break
                        case (expression[0] === '$'):
                            result = (expression.length === 1) ? (value in lexicon ? value : expression) : (labels ? labels[expression.slice(1)] : expression)
                            break
                        case (expression[0] === '@'):
                            result = fields ? lexicon.fields[expression.slice(1)] : expression
                            break
                        case (expression[0] === '#'):
                            result = cells ? lexicon.cells[expression.slice(1)] : expression
                            break
                        case (expression[0] === '~'):
                            result = context ? lexicon.context[expression.slice(1)] : expression
                            break
                        case ((expression[0] === '[') && expression.endsWith(']')):
                            expression = []
                            for (let i = 0, s = expression.split(','), l = s.length; i < l; i++) expression.push(s[i].trim())
                            flags.inner = true
                            result = this.resolveVariables(expression, flags, lexicon)
                            break
                        case ((expression[0] === '{') && expression.endsWith('}')):
                            const entries = expression.split(',')
                            expression = {}
                            for (let i = 0, s = entries[i].trim().split(':', 2), s0 = s[0].trim(), l = entries.length; i < l; i++, s = entries[i].trim().split(':', 2), s0 = s[0].trim())
                                expression[s[1] === undefined ? ((s0[s0.length - 1] in this.sys.valueAliases) ? s0.slice(0, -1) : s0) : s0] = (s[1] ?? this.sys.valueAliases[s0[s0.length - 1]] ?? s0)
                            flags.inner = true
                            result = this.resolveVariables(expression, flags, lexicon)
                            break
                        case ((expression[0] === '"') && expression.endsWith('"')):
                        case ((expression[0] === "'") && expression.endsWith("'")):
                            result = expression.slice(1, -1)
                            break
                        case (this.sys.regex.isNumeric.test(expression)):
                            result = value % 1 === 0 ? parseInt(value, 10) : parseFloat(value)
                            break
                        default:

                    }
                    break
                case Array.isArray(expression):
                    result = []
                    for (let i = 0, l = expression.length, a = spread && Array.isArray(dft); i < l; i++)
                        result.push(this.resolveVariables(expression[i], { inner: true, default: a ? dft[i] : dft }, lexicon))
                    break
                case this.isPlainObject(value):
                    result = {}
                    const dftIsObject = spread && this.isPlainObject(dft)
                    for (const key in expression) {
                        let keyFlags = { inner: true, default: dftIsObject ? dft[key] : dft }
                        result[this.resolveVariables(key, lexicon, keyFlags)] = this.resolveVariables(expression[key], keyFlags, lexicon)
                    }
            }
            return result ?? dft
        }
    },
    resolveUrl: {
        enumerable: true, value: function (value, base) {
            if (typeof value !== 'string') return value
            if (value.startsWith('https://') || value.startsWith('http://')) return value
            if (this.sys.regexp.protocolSplitter.test(value)) {
                const [protocol, hostpath] = value.split(this.sys.regexp.protocolSplitter), helperName = `${protocol}://`
                if (typeof this.app.helpers[helperName] === 'function') return this.useHelper(helperName, hostpath)
                if (typeof this.env.helpers[helperName] === 'function') return this.env.helpers[helperName](hostpath)
                return value
            }
            return new URL(value, base ?? document.baseURI).href
        }
    },
    runTransform: {
        enumerable: true, value: async function (transform, data = {}, element = undefined, variableMap = {}) {
            if (transform) transform = transform.trim()
            const transformKey = transform
            let expression, helperAlias
            if (this.app.transforms[transformKey] === true) {
                let waitCount = 0
                while ((waitCount <= 100) && (this.app.transforms[transformKey] === true)) {
                    await new Promise(resolve => globalThis.requestIdleCallback ? globalThis.requestIdleCallback(resolve, { timeout: 100 }) : setTimeout(resolve, 100))
                }
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
            const helperAliases = (this.env.options['application/x-jsonata']?.helpers ?? {})
            for (const a in helperAliases) if (this.app.helpers[helperAlias = helperAliases[a]] && transform.includes(`$${a}(`)) await this.loadHelper(helperAlias)
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
        value: {
            cells: {},
            components: { classes: {}, natives: new WeakMap(), bindings: new WeakMap(), virtuals: new WeakMap() },
            eventTarget: new EventTarget(),
            facets: { classes: {}, instances: new WeakMap() },
            helpers: {}, libraries: {}, namespaces: {}, observers: new WeakMap(), regexp: {}, snippets: {}, transforms: {}, types: {},
        }
    },
    binders: {
        value: {
            pattern: async function (container, position, envelope) {
                const { vars } = envelope, { expression } = vars
                let { regexp } = vars
                regexp ??= new RegExp(expression)
                this.app.regexp[expression] ??= this.env.regexp[expression] ?? regexp
                return { regexp }
            },
            proxy: async function (container, position, envelope) {
                const { vars } = envelope, { parentObjectName, useHelper, isSpread } = vars
                if (useHelper && parentObjectName) await this.loadHelper(parentObjectName)
            },
            routerhash: async function (container, position, envelope) {
                const { signal } = envelope
                globalThis.addEventListener('hashchange', event => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash })), { signal })
            },
            selector: async function (container, position, envelope) {
                const { vars, signal } = envelope, { scope: scopeStatement, selector: selectorStatement } = vars, scope = this.resolveScope(scopeStatement, container)
                if (!scope) return {}
                let [selector, eventList] = selectorStatement.split('!').map(s => s.trim())
                if (eventList) {
                    eventList = eventList.split(',').map(s => s.trim()).filter(s => !!s)
                } else if (container.dataset.facetCid) {
                    const { statements } = this.app.facets.classes[container.dataset.facetCid] ?? {}
                    if (!statements) return { selector, scope }
                    const [statementIndex, stepIndex] = position.split('-').map(s => parseInt(s))
                    if (statements[statementIndex].steps.length === stepIndex + 1) return { selector, scope }
                }
                const eventNames = eventList ?? Array.from(new Set(Object.values(this.sys.defaultEventTypes).concat(['click'])))
                for (let eventName of eventNames) {
                    let keepDefault = eventName.slice(-3).includes('+'), exactMatch = eventName.slice(-3).includes('='), once = eventName.slice(-3).includes('-')
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
                        let tagDefaultEventType = targetElement.constructor.events?.default ?? this.sys.defaultEventTypes[targetElement.tagName.toLowerCase()] ?? 'click'
                        if (!eventList && (event.type !== tagDefaultEventType)) return
                        if (!keepDefault) event.preventDefault()
                        container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(targetElement, undefined, event) }))
                    }, { signal, once })
                }
                return { selector, scope }
            },
            state: async function (container, position, envelope) {
                const { signal, vars } = envelope, { shape } = vars, items = []
                let { target } = vars, getReturnValue
                switch (shape) {
                    case 'single':
                        target[target.type] = target.type === 'field' ? this.getField(container, target.name) : this.getCell(target.name)
                        getReturnValue = () => target[target.type].get()
                        items.push(target)
                        break
                    case 'array':
                        for (const t of target) t[t.type] = t.type === 'field' ? this.getField(container, t.name) : this.getCell(t.name)
                        getReturnValue = () => {
                            const r = target.map(t => t[t.type].get())
                            return r.some(rr => rr == undefined) ? undefined : r
                        }
                        items.push(...target)
                        break
                    case 'object':
                        if (Array.isArray(target)) target = Object.fromEntries(target)
                        for (const t of Object.values(target)) t[t.type] = t.type === 'field' ? this.getField(container, t.name) : this.getCell(t.name)
                        getReturnValue = () => {
                            const r = {}
                            for (const key in target) r[key] = target[key][target[key].type].get()
                            return Object.values(r).every(rr => rr == undefined) ? undefined : r
                        }
                        items.push(...Object.values(target))
                }
                for (const item of items) {
                    item[item.type].eventTarget.addEventListener('change', event => {
                        const detail = getReturnValue()
                        if (detail != undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                    }, { signal })
                }
                return { getReturnValue, shape, target }
            }
        }
    },
    handlers: {
        value: {
            json: async function (container, position, envelope, value) {
                return this.mergeJsonValueWithVariables(envelope.vars.value, envelope, value)
            },
            network: async function (container, position, envelope, value) {
                const { labels, env, vars } = envelope, { expression, expressionIncludesVariable, returnFullRequest } = vars
                let url = this.mergeVariables(expression, value, labels, env)
                if (!url) return
                const options = {}
                if (!((value == undefined) || (expressionIncludesVariable && typeof value === 'string'))) {
                    Object.assign(options, (value instanceof Object && (value.method || value.body)) ? value : { method: 'POST', body: value })
                    if (options.body && (!(options?.headers ?? {})['Content-Type'] && !(options?.headers ?? {})['content-type'])) {
                        options.headers ||= {}
                        options.headers['Content-Type'] ||= options.contentType ?? options['content-type']
                        delete options['content-type']
                        delete options.contentType
                        if (!options.headers['Content-Type']) {
                            if (typeof options.body === 'string') {
                                if (['null', 'true', 'false'].includes(options.body) || this.sys.regexp.isNumeric.test(options.body) || this.sys.regexp.isJSONObject.test(options.body)) {
                                    options.headers['Content-Type'] = 'application/json'
                                } else if (this.sys.regexp.isFormString.test(options.body)) {
                                    options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
                                } else if (this.sys.regexp.isDataUrl.test(options.body)) {
                                    options.headers['Content-Type'] = this.sys.regexp.isDataUrl.exec(options.body)[1]
                                }
                            } else {
                                options.headers['Content-Type'] = 'application/json'
                            }
                        }
                    }
                    if (options.body && typeof options.body !== 'string') options.body = await this.serialize(options.body, options.headers['Content-Type'])
                }
                return fetch(url, options).then(r => {
                    if (returnFullRequest) {
                        return r
                    } else {
                        if (hasDefault && !r.ok) return
                        return r.ok ? this.parse(r) : undefined
                    }
                })
            },
            pattern: async function (container, position, envelope, value) {
                const { vars } = envelope, { expression } = vars
                if (typeof value !== 'string') value = `${value}`
                const match = value.match(this.app.regexp[expression])
                return match?.groups ? Object.fromEntries(Object.entries(match.groups)) : (match ? match[1] : undefined)
            },
            proxy: async function (container, position, envelope, value) {
                const { vars, labels, env } = envelope, { isSpread, useHelper, parentObjectName, childMethodName } = vars, umMergedArgs = {}
                const { parentArgs, childArgs } = umMergedArgs
                if (useHelper) return Promise.resolve(this.useHelper(parentObjectName, ...this.mergeArgs(parentArgs, value, envelope)))
                if (childMethodName) {
                    const { childArgs } = vars
                    if (!(globalThis[parentObjectName] instanceof Object)) return
                    if (typeof globalThis[parentObjectName][childMethodName] !== 'function') return
                    return globalThis[parentObjectName][childMethodName](...this.mergeArgs(childArgs, value, envelope))
                }
                return globalThis[parentObjectName](...this.mergeArgs(childArgs, value, envelope))
            },
            router: async function (container, position, envelope, value) {
                switch (typeof value) {
                    case 'string':
                        document.location = value
                        break
                    case 'object':
                        if (!value) break
                        for (const [k, v] of Object.entries(value)) {
                            if (k.endsWith(')') && k.includes('(')) {
                                let funcName = k.trim().slice(0, -2).trim()
                                switch (funcName) {
                                    case 'assign': case 'replace':
                                        document.location[funcName]((funcName === 'assign' || funcName === 'replace') ? v : undefined)
                                        break
                                    case 'back': case 'forward':
                                        history[funcName]()
                                        break
                                    case 'go':
                                        history[funcName](parseInt(v) || 0)
                                        break
                                    case 'pushState': case 'replaceState':
                                        history[funcName](...(Array.isArray(v) ? v : [v]))
                                }
                            } else if (typeof v === 'string') {
                                document.location[k] = v
                                break
                            }
                        }
                }
                return Object.fromEntries(Object.entries(document.location).filter(ent => typeof ent[1] !== 'function'))
            },
            ...Object.fromEntries(
                ['hash', 'pathname', 'search'].map(k => ([`router${k}`, async function (container, position, envelope, value) {
                    if (value != undefined && (typeof value === 'string')) document.location[k] = value
                    return document.location[k].slice(1) || undefined
                }]))),
            selector: async function (container, position, envelope, value) {
                const { vars } = envelope, { selector, scope } = vars
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
            state: async function (container, position, envelope, value) {
                const { vars } = envelope, { getReturnValue, shape, target } = vars
                if (value == undefined) return getReturnValue()
                switch (shape) {
                    case 'single':
                        target[target.type].set(value, target.mode)
                        break
                    case 'array':
                        if (Array.isArray(value)) for (const [i, v] of value.entries()) if (v != undefined) target[i][target[i].type].set(v, target[i].mode)
                        break
                    case 'object':
                        if (value instanceof Object) for (const [k, v] of Object.entries(value)) if (v != undefined) if (k in target) {
                            target[k][target[k].type].set(v, target[k].mode)
                        }
                }
            },
            string: async function (container, position, envelope, value) {
                return this.mergeVariables(envelope.vars.expression, value, envelope.labels, envelope.env)
            },
            transform: async function (container, position, envelope, value) {
                const { labels, env } = envelope, { block, expression } = envelope.vars, fields = Object.freeze(Object.fromEntries(Object.entries((this.app.facets.instances.get(container) ?? {}).fields).map(f => [f[0], f[1].get()]))),
                    cells = Object.freeze(Object.fromEntries(Object.entries(this.app.cells).map(c => [c[0], c[1].get()])))
                return this.runTransform(expression, value, container, { labels, fields, cells, context: Object.freeze({ ...env.context }) })
            },
            variable: async function (container, position, envelope, value) {
                return this.mergeVariables(envelope.vars.expression, value, envelope.labels, envelope.env)
            },
            wait: async function (container, position, envelope, value) {
                const { labels, env, vars } = envelope, { expression } = vars, mergedExpression = this.mergeVariables(expression, value, labels, env),
                    done = () => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: value }))
                let ms = 0, now = Date.now()
                if (mergedExpression === 'frame') {
                    await new Promise(resolve => globalThis.requestAnimationFrame(resolve))
                    done()
                } else if (mergedExpression.startsWith('idle')) {
                    let timeout = mergedExpression.split(':')[0]
                    timeout = timeout ? (parseInt(timeout) || 1) : 1
                    await new Promise(resolve => globalThis.requestIdleCallback ? globalThis.requestIdleCallback(resolve, { timeout }) : setTimeout(resolve, timeout))
                    done()
                } else if (mergedExpression[0] === '+') {
                    ms = parseInt(mergedExpression.slice(1)) || 1
                } else if (this.sys.regexp.isNumeric.test(mergedExpression)) {
                    ms = (parseInt(mergedExpression) || 1) - now
                } else {
                    let mergedExpressionSplit = mergedExpression.split(':').map(s => s.trim())
                    if ((mergedExpressionSplit.length === 3) && mergedExpressionSplit.every(s => this.sys.regexp.isNumeric.test(s))) {
                        ms = Date.parse(`${(new Date()).toISOString().split('T')[0]}T${mergedExpression}Z`)
                        if (ms < 0) ms = (ms + (1000 * 3600 * 24))
                        ms = ms - now
                    } else {
                        ms = Date.parse(mergedExpression) - now
                    }
                }
                ms = Math.max(ms, 0)
                await new Promise(resolve => setTimeout(resolve, ms))
                done()
            }
        }
    },
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
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g, classMatch: /(\.[a-zA-Z0-9\-]+)+/g, constructorFunction: /constructor\s*\(.*?\)\s*{[^}]*}/s,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isHTML: /<[^>]+>|&[a-zA-Z0-9]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;/,
                isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi, pipeSplitter: /(?<!\|)\|(?!\|)(?![^\[]*\])/, protocolSplitter: /\:\/\/(.+)/,
                isRgb: /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/, isRgba: /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
                selectorBranchSplitter: /\s*,\s*(?![^"']*["'][^"']*$)/, selectorSegmentSplitter: /(?<=[^\s>+~|\[])\s+(?![^"']*["'][^"']*$)|\s*(?=\|\||[>+~](?![^\[]*\]))\s*/,
                spaceSplitter: /\s+/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g, tagMatch: /^[a-z0-9\-]+/g, isLocalUrl: /^(\.\.\/|\.\/|\/)/
            }),
            voidElementTags: Object.freeze(new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])),
            insertPositions: Object.freeze({ after: true, append: false, before: true, prepend: false, replaceChildren: false, replaceWith: true }),
            impliedScopes: Object.freeze({ ':': '*', '#': 'html' }),
            autoScopes: Object.freeze(new Set(['head', 'body', '^', '~', 'root', 'host', '*', 'html', 'document', 'documentElement', 'window'])),
            valueAliases: Object.freeze({ 'null': null, 'undefined': undefined, 'false': false, 'true': true, '-': null, '?': undefined, '!': false, '.': true })
        })
    },

    activateTag: {
        value: async function (tag) {
            if (!tag || globalThis.customElements.get(tag) || !this.getCustomTag(tag)) return
            const [namespace, ...name] = tag.split('-'), namespaceBase = this.resolveUrl(this.app.namespaces[namespace] ?? this.env.namespaces[namespace]
                ?? (namespace === 'component' ? './components' : `./components/${namespace}`)), id = `${namespaceBase}/${name.join('/')}.html`
            this.app.components.classes[id] = this.env.components[id] ?? (await this.compileComponent(id))
            for (const subspaceName of (this.app.components.classes[id].subspaces)) {
                let virtualSubspaceName = `${subspaceName}${this.generateUUIDWithNoDashes()}`
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
    parseToValueOrVariable: {
        value: function (s, emptyDefault = undefined) {
            if (typeof s !== 'string') return s
            if (!s.length) return emptyDefault
            s = s.trim()
            switch (s) {
                case 'true': return true
                case 'false': return false
                case 'null': return null
                default:
                    if (this.sys.regexp.isNumeric.test(s) || (s[0] === '"' && (s.length > 1) && s.endsWith('"'))) return JSON.parse(s)
                    if (this.sys.regexp.hasVariable.test(s)) return s
                    return '${' + s + '}'
            }
        }
    },
    canonicalizeJsonExpressionToUnmergedValue: {
        value: function (expression) {
            let value = null
            if (expression[0] === '{' && expression.endsWith('}')) {
                value = {}
                for (const pair of expression.slice(1, -1).split(',')) {
                    let [k, v = true] = pair.trim().split(':').map(s => this.parseToValueOrVariable(s, null))
                    value[k] = v
                }
            } else if (expression[0] === '[' && expression.endsWith(']')) {
                value = []
                for (let s of expression.slice(1, -1).split(',')) value.push(this.parseToValueOrVariable(s, null))
            } else {
                try { value = JSON.parse(expression) } catch (e) { }
            }
            return value
        }
    },
    generateUUIDWithNoDashes: {
        value: function () {
            return ([...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''))
        }
    },
    getCustomTag: {
        value: function (element) {
            let tag = (element instanceof HTMLElement) ? (element.getAttribute('is') || element.tagName).toLowerCase() : `${element}`.toLowerCase()
            if (!tag) return
            return ((tag[0] !== '-') && !tag.endsWith('-') && tag.includes('-')) ? tag : undefined
        }
    },
    getExports: {
        value: async function (url) {
            return url.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(url)))?.instance?.exports : (await import(url))
        }
    },
    getStateContainer: {
        value: function (name, facetInstanceOrContainer) {
            if (!name) return
            const type = facetInstanceOrContainer ? 'field' : 'cell'
            let containers
            switch (type) {
                case 'field':
                    if (facetInstanceOrContainer instanceof this.Facet) {
                        containers = facetInstanceOrContainer.fields
                    } else if (facetInstanceOrContainer instanceof HTMLElement) {
                        containers = this.app.facets.instances.get(facetInstanceOrContainer).fields
                    }
                    break
                case 'cell':
                    containers = this.app.cells
                    break
            }
            if (!containers[name]) {
                const container = {
                    type, eventTarget: new EventTarget(),
                    get: function () { return this.value },
                    set: function (value, labelMode) {
                        let isSame = this.value === value
                        if (!isSame) try { isSame = JSON.stringify(this.value) === JSON.stringify(value) } catch (e) { }
                        if (isSame) {
                            if (labelMode === 'force') container.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                            return this
                        }
                        this.value = value
                        if (labelMode !== 'silent') container.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                        return this
                    },
                    value: undefined, name
                }
                containers[name] = container
            }
            return containers[name]
        }
    },
    getStateGroup: {
        value: function (expression, typeDefault = 'cell', element) {
            const parseOnly = !(element instanceof HTMLElement)
            let group, shape
            if (!parseOnly) element = this.app.components.virtuals.get(element) ?? element
            const canonicalizeName = (name) => {
                let type
                switch (name[0]) {
                    case '@': type = 'field'; break
                    case '#': type = 'cell'; break
                    default: type = typeDefault
                }
                const modeFlag = name[name.length - 1],
                    mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
                if (mode) name = name.slice(0, -1).trim()
                return { name: name, mode, type }
            }, getStateTarget = parseOnly ? undefined : (name, mode, type) => {
                switch (type) {
                    case 'cell':
                        return { cell: this.getCell(name), type, mode }
                    case 'field':
                        return { field: this.getField(element, name), type, mode }
                }
            }
            switch (expression[0]) {
                case '{':
                    group = {}
                    shape = 'object'
                    for (const pair of expression.slice(1, -1).trim().split(',')) {
                        let [key, rawName] = pair.trim().split(':').map(s => s.trim())
                        if (!rawName) rawName = key
                        const { name, mode, type } = canonicalizeName(rawName)
                        if (mode) key = key.slice(0, -1)
                        group[key] = { name, mode, type }
                        if (!parseOnly) group[key][type] = getStateTarget(name, mode, type)
                    }
                    break
                case '[':
                    group = []
                    shape = 'array'
                    for (let t of expression.slice(1, -1).split(',')) {
                        t = t.trim()
                        if (!t) continue
                        const { name, mode, type } = canonicalizeName(t), index = group.push({ name, mode, type }) - 1
                        if (!parseOnly) group[index][type] = getStateTarget(name, mode, type)
                    }
                    break
                default:
                    shape = 'single'
                    expression = expression.trim()
                    if (!expression) return
                    group = canonicalizeName(expression)
                    if (!parseOnly) group = getStateTarget(group.name, group.mode, group.type)
            }
            if (parseOnly) return { group, shape }
            return group
        }
    },
    getVariable: {
        value: function (expression, value, labels, env) {
            if (!expression) return value
            switch (expression[0]) {
                case '"': case "'":
                    return expression.slice(1, -1)
                case '{':
                    if (expression.endsWith('}')) try { JSON.parse(expression) } catch (e) { return expression }
                    return expression
                case '[':
                    if (expression.endsWith(']')) try { JSON.parse(expression) } catch (e) { return expression }
                    return expression
                case 't': case 'f': case 'n': case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
                    switch (expression) {
                        case 'null': case 'true': case 'false':
                            return JSON.parse(expression)
                        default:
                            if (expression.match(this.sys.regexp.isNumeric)) return JSON.parse(expression)
                            return labels[expression]
                    }
                case '~':
                    expression = expression.slice(1)
                    const system = {
                        document, window, E: {
                            app: { compile: this.app.compile, dev: this.app.dev, expose: this.app.expose, namespaces: this.app.namespaces, _globalNamespace: this.app._globalNamespace },
                            env: { namespaces: this.env.namespaces, options: this.env.options },
                            version: this.version
                        }
                    }
                    return env.context[expression] ?? system[expression]
                case '#':
                    return (env.cells[expression.slice(1)] ?? {})?.get()
                case '@':
                    return (env.fields[expression.slice(1)] ?? {})?.get()
                case '$':
                    expression = expression.slice(1)
                    if (!expression) return value
                    return labels[expression] ?? (env.fields[expression] ?? {})?.get() ?? (env.cells[expression] ?? {})?.get() ?? env.context[expression]
                default:
                    return labels[expression]
            }
        }
    },
    installModule: {
        value: async function (moduleName) {
            const { module } = (await import((new URL(`modules/${moduleName}.js`, import.meta.url)).href))
            for (const k in module) if (typeof module[k].value === 'function') module[k].value = module[k].value.bind(this)
            Object.defineProperties(this, module)
        }
    },
    mergeArgs: {
        value: function (args, value, envelope = {}) {
            const newArgs = []
            for (let a of (args ?? [])) {
                const aSpread = a.startsWith('...')
                if (aSpread) a = a.slice(3)
                a = this.parseToValueOrVariable(a)
                if (aSpread && !Array.isArray(a)) a = [a]
                if (value !== undefined) {
                    if (aSpread) {
                        const newA = []
                        for (const aa of a) newA.push(this.mergeVariables(aa, value, envelope))
                        a = newA
                    } else {
                        a = this.mergeVariables(a, value, envelope)
                    }
                }
                aSpread ? newArgs.push(...a) : newArgs.push(a)
            }
            return newArgs
        }
    },
    mergeJsonValueWithVariables: {
        value: function (v, envelope, value) {
            if (v === null) return v
            switch (typeof v) {
                case 'object':
                    const { labels, env } = envelope
                    let rv
                    if (Array.isArray(v)) {
                        rv = []
                        for (const vv of v) rv.push((typeof vv === 'string' && (vv[0] === '$') && (vv[1] === '{') && vv.endsWith('}')) ? this.mergeVariables(vv, value, labels, env) : vv)
                    } else {
                        rv = {}
                        for (let kk in v) {
                            const vv = v[kk]
                            if ((typeof kk === 'string' && (kk[0] === '$') && (kk[1] === '{') && kk.endsWith('}'))) kk = this.mergeVariables(kk, value, labels, env)
                            if (typeof kk !== 'string' && typeof kk !== 'number') continue
                            rv[kk] = (typeof vv === 'string' && (vv[0] === '$') && (vv[1] === '{') && vv.endsWith('}')) ? this.mergeVariables(vv, value, labels, env) : vv
                        }
                    }
                    return rv
                default:
                    return v
            }
        }
    },
    mountFacet: {
        value: async function (facetContainer) {
            let { type, textContent } = facetContainer, src = facetContainer.getAttribute('src'), facetInstance, FacetClass, facetCid
            if (type === 'facet/element') type = src ? 'application/element' : 'directives/element'
            switch (type) {
                case 'directives/element':
                    if (!this.app.compile) return
                    const directives = await this.canonicalizeDirectives(src ? await fetch(this.resolveUrl(src)).then(r => r.text()) : textContent)
                    if (!directives) break
                    facetCid = await this.cid(directives)
                    this.app.facets.classes[facetCid] ??= await this.compileFacet(directives, facetCid)
                    break
                case 'application/element':
                    if (!src || this.app.facets.classes[src]) break
                    FacetClass = (this.env.facets[src]?.prototype instanceof this.Facet) ? this.env.facets[src] : (await this.facetFactory(await import(this.resolveUrl(src))))
                    facetCid = FacetClass.cid
                    this.app.facets.classes[facetCid] = FacetClass
                    this.app.facets.classes[src] = FacetClass
                    break
            }
            FacetClass = this.app.facets.classes[facetCid]
            if (this.app.dev && !this.app.facets.exports.has(FacetClass)) this.app.facets.exports.set(FacetClass, { statements: JSON.parse(JSON.stringify(FacetClass.statements)) })
            if (!FacetClass || !(FacetClass.prototype instanceof this.Facet)) return
            if (this.app.dev) facetContainer.dataset.facetCid = facetCid
            facetInstance = new FacetClass()
            this.app.facets.instances.set(facetContainer, facetInstance)
            const rootNode = facetContainer.getRootNode(), fields = {}, cells = {},
                context = Object.freeze(rootNode instanceof ShadowRoot ? { ...this.env.context, ...Object.fromEntries(Object.entries(rootNode.host.dataset)) } : this.env.context)
            for (const fieldName of FacetClass.fieldNames) fields[fieldName] = this.getField(facetInstance, fieldName)
            for (const cellName of FacetClass.cellNames) cells[cellName] = this.getCell(cellName)
            Object.freeze(fields)
            Object.freeze(cells)
            facetInstance.observer = new MutationObserver(records => facetInstance.disabled = facetContainer.hasAttribute('disabled'))
            facetInstance.observer.observe(facetContainer, { attributes: true, attributeFilter: ['disabled'] })
            facetInstance.disabled = facetContainer.hasAttribute('disabled')
            await facetInstance.run(facetContainer, Object.freeze({ fields, cells, context }))
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
    resolvePackageItem: {
        value: async function (item, scope) {
            switch (scope) {
                case 'components': case 'facets':
                    return await item(this)
                default:
                    return typeof item === 'function' ? (await item(this)) : item
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
    runElementMethod: {
        value: function (statement, arg, element) {
            let [funcName, ...argsRest] = statement.split('(')
            if (typeof element[funcName] === 'function') {
                argsRest = argsRest.join('(').slice(0, -1)
                argsRest = argsRest ? argsRest.split(',').map(a => this.mergeVariables(a.trim(), a.trim())) : []
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

    componentFactory: {
        value: async function (manifest, id) {
            let ComponentClass
            if (manifest.prototype instanceof this.Component) {
                ComponentClass = manifest
            } else {
                if (!this.isPlainObject(manifest)) return
                const { extends: mExtends, native: mNative, script: mScript, style: mStyle, template: mTemplate } = manifest
                let cExtends = mExtends ? ((mNative && mExtends === mNative) ? mExtends : this.resolveUrl(mExtends)) : undefined,
                    native = mNative && (typeof mNative === 'string') && !mNative.includes('-') && this.isValidTag(mNative) ? mNative : undefined,
                    style = mStyle && (typeof mStyle === 'string') ? mStyle : (mStyle instanceof HTMLElement ? mStyle.textContent : ''),
                    template = mTemplate && (typeof mTemplate === 'string') ? mTemplate : (mTemplate instanceof HTMLElement ? mTemplate.innerHTML : ''),
                    script = mScript && (typeof mScript === 'string') ? mScript.replace('export default ', '').trim() : 'class extends E.Component {}',
                    [scriptHead, ...scriptBody] = script.split('{')
                script = `  ${scriptHead} {

        static {
            this.extends = ${cExtends ? ("'" + cExtends + "'") : "undefined"}
            this.native = ${native ? ("'" + native + "'") : "undefined"}
            const styleCss = \`${style}\`, templateHtml = \`${template}\`
            if (styleCss) {
                this.style = document.createElement('style')
                this.style.textContent = styleCss
            }
            if (templateHtml) {
                this.template = document.createElement('template')
                this.template.innerHTML = templateHtml
            }
        }

${scriptBody.join('{')}`

                this.setGlobalNamespace()
                const classAsModuleUrl = URL.createObjectURL(new Blob([`const E = globalThis['${this.app._globalNamespace}']; export default ${script}`], { type: 'text/javascript' }))
                ComponentClass = (await import(classAsModuleUrl)).default
                URL.revokeObjectURL(classAsModuleUrl)
            }
            Object.defineProperty(ComponentClass, 'id', { enumerable: true, value: id })
            Object.defineProperty(ComponentClass, 'E', { value: this })
            Object.defineProperty(ComponentClass.prototype, 'E', { value: this })
            return ComponentClass
        }
    },
    Component: {
        value: class extends globalThis.HTMLElement {
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
        }
    },

    facetFactory: {
        value: async function (manifest) {
            let FacetClass
            if (manifest.prototype instanceof this.Facet) {
                FacetClass = manifest
            } else {
                if (!this.isPlainObject(manifest)) return
                const { fieldNames = [], cellNames = [], statements = [], cid } = manifest
                if (!cid || (typeof cid !== 'string')) return
                const source = `  class ${cid} extends E.Facet {

        static cid = '${cid}'
        static fieldNames = ${JSON.stringify(Array.from(fieldNames))}
        static cellNames = ${JSON.stringify(Array.from(cellNames))}
        static statements = ${JSON.stringify(statements)}

    }`

                this.setGlobalNamespace()
                const classAsModuleUrl = URL.createObjectURL(new Blob([`const E = globalThis['${this.app._globalNamespace}']; export default ${source}`], { type: 'text/javascript' }))
                FacetClass = (await import(classAsModuleUrl)).default
                URL.revokeObjectURL(classAsModuleUrl)
            }
            Object.defineProperty(FacetClass, 'E', { value: this })
            Object.defineProperty(FacetClass.prototype, 'E', { value: this })
            return FacetClass
        }
    },
    Facet: {
        value: class {
            static E
            controller
            controllers = {}
            fields = {}
            observer
            vars = {}
            disabled
            constructor() {
                this.controller = new AbortController()
                for (const fieldName of this.constructor.fieldNames) this.fields[fieldName] = this.constructor.E.getField(this, fieldName)
                Object.freeze(this.fields)
            }
            async run(container, env) {
                for (const [statementIndex, statement] of this.constructor.statements.entries()) {
                    const { steps = [] } = statement, labels = {}, saveToLabel = (stepIndex, label, value, labelMode) => {
                        labels[`${stepIndex}`] = value
                        if (label && (label != stepIndex)) {
                            switch (label[0]) {
                                case '@':
                                    env.fields[label.slice(1)].set(value, labelMode)
                                    break
                                case '#':
                                    env.cells[label.slice(1)].set(value, labelMode)
                                    break
                                default:
                                    labels[label] = value
                            }
                        }
                    }
                    for (const label of statement.labels) labels[label] = undefined
                    for (const [stepIndex, step] of steps.entries()) {
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, defaultExpression, params } = step,
                            { handler, ctx = {} } = params, { binder, signal, vars = {} } = ctx, envelope = { labels, env }
                        this.vars[position] = vars
                        envelope.vars = this.vars[position]
                        if (binder) {
                            if (signal) {
                                this.controllers[position] = new AbortController()
                                envelope.signal = this.controllers[position].signal
                            }
                            Object.assign(this.vars[position], await this.constructor.E.binders[handler](container, position, envelope))
                        }
                        container.addEventListener(`done-${position}`, async event => {
                            saveToLabel(stepIndex, label, event.detail, labelMode)
                        }, { signal: this.controller.signal })
                        if (stepIndex) {
                            const previousStepIndex = stepIndex - 1
                            container.addEventListener(`done-${statementIndex}-${previousStepIndex}`, async event => {
                                if (this.disabled) return
                                let passedInValue = labels[`${previousStepIndex}`]
                                let detail = await this.constructor.E.handlers[handler](container, position, envelope, passedInValue)
                                    ?? (defaultExpression ? this.constructor.E.mergeVariables(this.constructor.E.parseToValueOrVariable(defaultExpression), undefined, labels, env) : undefined)
                                if (detail !== undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                            }, { signal: this.controller.signal })
                        } else {
                            container.addEventListener('run', async event => {
                                if (this.disabled) return
                                let detail = await this.constructor.E.handlers[handler](container, position, envelope, undefined)
                                    ?? (defaultExpression ? this.constructor.E.mergeVariables(this.constructor.E.parseToValueOrVariable(defaultExpression), undefined, labels, env) : undefined)
                                if (detail !== undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                            }, { signal: this.controller.signal })
                        }
                    }
                }
                container.dispatchEvent(new CustomEvent('run'))
            }
            valueOf() { return { ...this.fields } }
            toJSON() { return this.valueOf() }
        }
    }

})
ElementHTML.Component.E = ElementHTML
const metaUrl = new URL(import.meta.url), metaOptions = metaUrl.searchParams, flagPromises = []
for (const flag of ['compile', 'dev', 'expose']) if (metaOptions.has(flag)) flagPromises.push(ElementHTML[flag[0].toUpperCase() + flag.slice(1)](metaOptions.get(flag)))
await Promise.all(flagPromises)
for (const scope of ['helpers', 'loaders']) for (const n in ElementHTML.env[scope]) ElementHTML.env[scope][n] = ElementHTML.env[scope][n].bind(ElementHTML)
if (metaOptions.has('packages')) {
    const packageList = metaOptions.get('packages').split(',').map(s => s.trim()).filter(s => !!s),
        importmapElement = document.head.querySelector('script[type="importmap"]'), protocolLoaders = {}, importmap = { imports: {} }
    if (importmapElement) {
        try { Object.assign(importmap, JSON.parse(importmapElement.textContent.trim())) } catch (e) { }
    } else if (metaOptions.get('packages')) {
        for (const p of packageList) importmap.imports[p] = `./packages/${p}.js`
    } else {
        importmap.imports.main = './packages/main.js'
        packageList.push('main')
    }
    const imports = importmap.imports ?? {}, importPromises = new Map()
    for (const key of packageList) {
        let importUrl = imports[key], [protocol,] = importUrl.split('://')
        if ((protocol !== 'https') && (protocol !== importUrl)) if (typeof ElementHTML.env.loaders[(protocol = `${protocol}://`)] === 'function') await (protocolLoaders[protocol] ??= ElementHTML.env.loaders[protocol].bind(ElementHTML))()
        importUrl = ElementHTML.resolveUrl(importUrl)
        if (!importUrl) continue
        importPromises.set(importUrl, { promise: import(importUrl), key })
    }
    await Promise.all(Array.from(importPromises.values()))
    for (const [url, imp] of importPromises.entries()) await ElementHTML.ImportPackage(await imp.promise, url, imp.key)
}
if (metaOptions.has('load')) await ElementHTML.Load(undefined, (metaOptions.get('load') || '').split(',').map(s => s.trim()).filter(s => !!s))
export { ElementHTML }