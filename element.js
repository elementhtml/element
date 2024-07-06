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
            namespaces: { e: (new URL(`./e/components`, import.meta.url)).href },
            options: { 'application/x-jsonata': { helpers: { is: 'application/schema+json' } } }, regexp: {}, templates: {}, transforms: {}, types: {}
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
            this.app.packages = new Map()
            this.app.facets.exports = new WeakMap()
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
            if (pkg?.hooks?.preInstall === 'function') pkg = await (pkg.hooks.preInstall.bind(this))(pkg)
            for (const scope in pkg) if (scope in this.env) {
                const pkgScope = pkg[scope], envScope = this.env[scope]
                switch (scope) {
                    case 'context': case 'options':
                        for (const s in pkgScope) {
                            if (this.isPlainObject(envScope[s])) {
                                for (const n in pkgScope[s]) envScope[s][n] = this.isPlainObject(envScope[s][n]) ? Object.assign(envScope[s][n], pkgScope[s][n]) : pkgScope[s][n]
                            } else {
                                envScope[s] = pkgScope[s]
                            }
                        }
                        break
                    case 'components':
                        const componentNamespaceBase = (new URL('../components', packageUrl)).href,
                            namespaceExists = Object.values({ ...this.env.namespaces, ...(pkg.namespaces ?? {}) }).includes(componentNamespaceBase)
                        if (!namespaceExists) this.env.namespaces[packageKey] = componentNamespaceBase
                        const componentId = `${componentNamespaceBase}/${componentKey}.html`
                        for (const componentKey in pkgScope) envScope[componentId] = await this.componentFactory(pkgScope[componentKey], componentId)
                        if (this.app.dev) {
                            this.app.components.packages ??= {}
                            for (const componentKey in pkgScope) this.app.components.packages[componentKey] = packageKey
                        }
                        break
                    case 'facets':
                        for (const facetCid in pkgScope) envScope[facetCid] = this.facetFactory(pkgScope[facetCid])
                        if (this.app.dev) {
                            this.app.facets.packages ??= {}
                            for (const facetCid in pkgScope) this.app.facets.packages[facetCid] = packageKey
                        }
                        break
                    case 'helpers': case 'hooks': case 'loaders':
                        for (const f in pkgScope) if (typeof pkgScope[f] === 'function') envScope[f] = pkgScope[f].bind(this)
                        break
                    case 'namespaces':
                        for (const n in pkgScope) {
                            envScope[n] = this.resolveUrl(pkgScope[n], packageUrl)
                            if (envScope[n].endsWith('/')) envScope[n] = envScope[n].slice(0, -1)
                        }
                        break
                    case 'regexp':
                        for (const r in pkgScope) envScope[r] = new RegExp(pkgScope[r])
                        break
                    case 'templates':
                        for (const t in pkgScope) {
                            if (pkgScope[t] instanceof HTMLElement) {
                                envScope[t] = pkgScope[t]
                            } else if (typeof pkgScope[t] === 'string') {
                                if (pkgScope[t][0] === '`' && pkgScope[t].slice(-1) === '`') {
                                    envScope[t] = ('`' + this.resolveUrl(this.resolveTemplateKey(pkgScope[t]), packageUrl) + '`')
                                } else {
                                    const templateInstance = document.createElement('template')
                                    templateInstance.innerHTML = pkgScope[t]
                                    envScope[t] = templateInstance
                                }
                            }
                        }
                        break
                    default:
                        Object.assign(this.env[scope], pkg[scope])
                }
            }
            this.env.namespaces[packageKey] ||= `${this.resolveUrl('../', packageUrl)}components`
            pkg.hooks?.postInstall(pkg)
            if (this.app.dev) this.app.packages.set(packageKey, packageUrl)
        }
    },
    Load: {
        enumerable: true, value: async function (rootElement = undefined, preload = []) {
            if (!rootElement) {
                for (const a in this.env) Object.freeze(this.env[a])
                Object.freeze(this.env)
                for (const f of ['binders', 'handlers', 'parsers']) {
                    if (!this[f]) continue
                    for (const b in this[f]) this[f][b] = this[f][b].bind(this)
                    Object.freeze(this[f])
                }
                Object.freeze(this)
                if (!this.app.dev) {
                    console.log = () => { }
                    globalThis.addEventListener('unhandledrejection', event => event.preventDefault())
                }
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
                Object.freeze(this.app)
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
            if (!eventName) eventName = instance.constructor.events?.default ?? this.sys.defaultEventTypes[instance.tagName.toLowerCase()] ?? 'click'
            instance.dispatchEvent(new CustomEvent(eventName, { detail: value, bubbles, cancelable, composed }))
            return value
        }
    },
    dispatchCompoundEvent: {
        enumerable: true, value: async function (eventName, detail, element) {
            const event = new CustomEvent(eventName, { detail })
            return element.dispatchEvent(event)
                && (this.app.components.natives.get(element)?.dispatchEvent(event) || this.app.components.virtuals.get(element)?.dispatchEvent(event))
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
                    style = Object.fromEntries(Object.entries(value.style).filter(ent => !!ent[1] && (parseInt(ent[0]) != ent[0]))),
                    innerHTML = value.innerHTML, textContent = value.textContent, innerText = value.innerText
                result = {
                    ...Object.fromEntries(value.getAttributeNames().map(a => ([`@${a}`, value.getAttribute(a)]))),
                    ...Object.fromEntries(Object.entries(compile(['baseURI', 'checked', 'childElementCount', 'className',
                        'clientHeight', 'clientLeft', 'clientTop', 'clientWidth', 'id', 'lang', 'localName', 'name', 'namespaceURI',
                        'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'outerHTML', 'outerText', 'prefix',
                        'scrollHeight', 'scrollLeft', 'scrollLeftMax', 'scrollTop', 'scrollTopMax', 'scrollWidth',
                        'selected', 'slot', 'tagName', 'title'], []))),
                    innerHTML, textContent, innerText, style, classList, tag: (value.getAttribute('is') || value.tagName).toLowerCase(),
                    '.': (textContent.includes('<') && textContent.includes('>')) ? innerHTML : textContent,
                    '..': textContent, '...': innerText, '<>': innerHTML, '#': value.id
                }
                for (const p of ['id', 'name', 'value', 'checked', 'selected']) if (p in value) result[p] = value[p]
                for (const a of ['itemprop', 'class']) if (value.hasAttribute(a)) result[a] = value.getAttribute(a)
                if (value.hasAttribute('itemscope')) result.itemscope = true
                for (const c of Object.keys(classList)) result[`&${c}`] = true
                for (const ent of Object.entries(style)) result[`^${ent[0]}`] = ent[1]
                if (Array.isArray(value.constructor.properties?.flattenable)) for (const p of value.constructor.properties?.flattenable) result[p] = value[p]
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
            if (!name) return
            if (!this.app.cells[name]) {
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
                this.app.cells[name] = cell
            }
            return this.app.cells[name]
        }
    },
    getField: {
        enumerable: true, value: function (facetInstanceOrContainer, fieldName) {
            if (!fieldName) return
            let fields
            if (facetInstanceOrContainer instanceof this.Facet) {
                fields = facetInstanceOrContainer.fields
            } else if (facetInstanceOrContainer instanceof HTMLElement) {
                fields = this.app.facets.instances.get(facetInstanceOrContainer).fields
            }
            if (!fields[fieldName]) {
                const field = {
                    type: 'field',
                    eventTarget: new EventTarget(),
                    get: function () { return this.value },
                    set: function (value, labelMode) {
                        let isSame = this.value === value
                        if (!isSame) try { isSame = JSON.stringify(this.value) === JSON.stringify(value) } catch (e) { }
                        if (isSame) {
                            if (labelMode === 'force') field.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                            return this
                        }
                        this.value = value
                        if (labelMode !== 'silent') field.eventTarget.dispatchEvent(new CustomEvent('change', { detail: value }))
                        return this
                    },
                    value: undefined, fieldName
                }
                fields[fieldName] = field
            }
            return fields[fieldName]
        }
    },
    isFacetContainer: {
        enumerable: true, value: function (element) {
            return ((element instanceof HTMLScriptElement) && (element.type === 'directives/element' || element.type === 'application/element'))
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
            const merge = exp => this.mergeVariables(exp.slice(2, -1), value, labels, env, true)
            return ((isMatch.length === 1) && (isMatch[0] === expression)) ? merge(expression) : expression.replace(this.sys.regexp.hasVariable, merge)
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
            if (!(element instanceof HTMLElement)) return
            if (data === null) return
            element = this.app.components.natives.get(element) ?? element
            const tag = (element.getAttribute('is') || element.tagName).toLowerCase()
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
                            if (typeof data === 'string') return element[data.includes('<') && data.includes('>') ? 'innerHTML' : 'textContent'] = data
                            return element.textContent = (data == undefined) ? '' : data
                    }
                }
            }
            const setProperty = (k, v, element) => {
                if (k.includes('(') && k.endsWith(')')) {
                    return v != undefined ? this.runElementMethod(k, v, element) : undefined
                } else if (v === undefined) {
                    try { return delete element[k] } catch (e) { return }
                }
                element[k] = v
            }
            for (const [k, v] of Object.entries(data)) {
                if (!k) continue
                switch (k[0]) {
                    case '#':
                        if (k === '#') { element.setAttribute('id', v); continue }
                        if (k.charCodeAt(1) >= 65 && k.charCodeAt(1) <= 90) {
                            element[`aria${k.slice(1)}`] = v
                        } else {
                            element.setAttribute(`aria-${k.slice(1)}`, v)
                        }
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
                                        renderExpression = renderExpression.slice(1, -1)
                                        let useTemplate
                                        if (renderExpression[0] === '`' && renderExpression.slice(-1) === '`') {
                                            renderExpression = renderExpression.slice(1, -1)
                                            if (this.app.templates[renderExpression] === true) {
                                                let waitCount = 0
                                                while ((waitCount <= 100) && (this.app.templates[renderExpression] === true)) {
                                                    await new Promise(resolve => requestIdleCallback ? requestIdleCallback(resolve, { timeout: 100 }) : setTimeout(resolve, 100))
                                                }
                                            }
                                            if (this.app.templates[renderExpression] === true) delete this.app.templates[renderExpression]
                                            if (this.app.templates[renderExpression] && (this.app.templates[renderExpression] instanceof HTMLTemplateElement)) {
                                                useTemplate = this.app.templates[renderExpression]
                                            } else if (this.env.templates[renderExpression]) {
                                                this.app.templates[renderExpression] = true
                                                const envTemplate = this.env.templates[renderExpression]
                                                useTemplate = document.createElement('template')
                                                if (envTemplate instanceof HTMLElement) {
                                                    useTemplate.innerHTML = envTemplate instanceof HTMLTemplateElement ? envTemplate.innerHTML : envTemplate.outerHTML
                                                } else if (typeof envTemplate === 'string') {
                                                    if (envTemplate[0] === '`' && envTemplate.endsWith('`')) {
                                                        let templateUrl = this.resolveTemplateKey(envTemplate)
                                                        useTemplate.innerHTML = await (await fetch(this.resolveUrl(templateUrl))).text()
                                                    } else {
                                                        useTemplate.innerHTML = envTemplate
                                                    }
                                                }
                                            } else {
                                                this.app.templates[renderExpression] = true
                                                useTemplate = document.createElement('template')
                                                let templateUrl = renderExpression
                                                if (templateUrl.startsWith('~/') || templateUrl.endsWith('.')) templateUrl = this.resolveTemplateKey('`' + templateUrl + '`')
                                                useTemplate.innerHTML = await (await fetch(this.resolveUrl(templateUrl))).text()
                                            }
                                            this.app.templates[renderExpression] = useTemplate
                                        } else {
                                            useTemplate = this.resolveScopedSelector(renderExpression, element)
                                        }
                                        if (useTemplate) this.renderWithTemplate(element, v, useTemplate, posMap[(posMatch ?? '').trim()], insertSelector)
                                        continue
                                    }
                                    const tagMatch = renderExpression.match(this.sys.regexp.tagMatch) ?? [],
                                        idMatch = renderExpression.match(this.sys.regexp.idMatch) ?? [], classMatch = renderExpression.match(this.sys.regexp.classMatch) ?? [],
                                        attrMatch = renderExpression.match(this.sys.regexp.attrMatch) ?? []
                                    this.renderWithTemplate(element, v, tagMatch[0], posMap[(posMatch ?? '').trim()], insertSelector, (idMatch[0] ?? '').slice(1),
                                        (classMatch[0] ?? '').slice(1).split('.').map(s => s.trim()).filter(s => !!s),
                                        Object.fromEntries((attrMatch ?? []).map(m => m.slice(1, -1)).map(m => m.split('=').map(ss => ss.trim())))
                                    )
                                    continue
                                }
                                setProperty(k.slice(1), v, element)
                        }
                    case '`':
                        let nestingTargets = Array.of(this.resolveScopedSelector(k.slice(1, -1), element) ?? [])
                        await Promise.all(nestingTargets.map(t => this.render(t, v)))
                        continue
                    case '~':
                        if (element.hasAttribute('itemscope')) {
                            this.render(element.querySelector(`[itemprop="${k.slice(1)}"]`), v)
                            break
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
            let scope, root, prop
            switch (scopeStatement) {
                case ':':
                    prop = 'body'
                case '~':
                    prop ||= 'head'
                    root = element.getRootNode()
                    return (root instanceof ShadowRoot) ? root : document[prop]
                case '*': case ':root': case ':host':
                    scope = element.getRootNode()
                    if (scopeStatement === ':host' && scope instanceof ShadowRoot) return scope.host
                    return (scope === document) ? document.documentElement : scope
                case ':document':
                    prop = 'documentElement'
                case ':body':
                    prop ||= 'body'
                case ':head':
                    prop ||= 'head'
                    return document[prop]
                default:
                    if (scopeStatement.startsWith('#')) return document.documentElement
                    return element.parentElement.closest(scopeStatement)
            }
        }
    },
    resolveScopedSelector: {
        enumerable: true, value: function (scopedSelector, element) {
            element = this.app.components.natives.get(element) ?? element
            const sMap = { '$': 'root', '#': 'document' }
            let scope = element, selector = scopedSelector
            if (sMap[selector[0]]) selector = `:${sMap[selector[0]]}|${selector}`
            if (selector.includes('|')) {
                const [scopeStatement, selectorStatement] = selector.split('|').map(s => s.trim())
                scope = this.resolveScope(scopeStatement, element)
                selector = selectorStatement
            }
            return this.resolveSelector(selector, scope)
        }
    },
    resolveSelector: {
        enumerable: true, value: function (selector, scope) {
            if (!selector) return scope
            if (selector[0] === '$') {
                if (!selector) return scope
                const catchallSelector = this.buildCatchallSelector(selector)
                return scope.querySelector(catchallSelector)
            }
            if (selector.includes('{') && selector.endsWith('}')) {
                let [selectorStem, sig] = selector.split('{')
                return this.sliceAndStep(sig.slice(0, -1), Array.from(scope.querySelectorAll(selectorStem)))
            }
            return scope.querySelector(selector)
        }
    },
    resolveUrl: {
        enumerable: true, value: function (value, base) {
            if (typeof value !== 'string') return value
            if (value.startsWith('https://') || value.startsWith('http://')) return value
            if (value.includes('://')) {
                const [protocol, hostpath] = value.split(/\:\/\/(.+)/), helperName = `${protocol}://`
                if (typeof this.app.helpers[helperName] === 'function') return this.useHelper(helperName, hostpath)
                if (typeof this.env.helpers[helperName] === 'function') return this.env.helpers[helperName](hostpath)
                return value
            }
            return new URL(value, base ?? document.baseURI).href
        }
    },
    runElementMethod: {
        enumerable: true, value: function (statement, arg, element) {
            let [funcName, ...argsRest] = statement.split('(')
            if (typeof element[funcName] === 'function') {
                argsRest = argsRest.join('(').slice(0, -1)
                argsRest = argsRest ? argsRest.split(',').map(a => this.mergeVariables(a.trim(), a.trim())) : []
                return element[funcName](...argsRest, ...([arg]))
            }
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
                if (transformKey[0] === '`') [transform, expression] = this.env.transforms[transformKey] ? [transformKey, this.env.transforms[transformKey]]
                    : [await fetch(this.resolveUrl(transformKey.slice(1, -1).trim())).then(r => r.text()), undefined]
                if (!transform) {
                    delete this.app.transforms[transformKey]
                    return data
                }
                expression ||= this.env.transforms[transformKey]
                if (!expression) expression = this.useHelper(await this.loadHelper('application/x-jsonata'), transform)
                this.app.transforms[transformKey] = [transform, expression]
            } else {
                if (transformKey[0] === '`') [transform, expression] = this.app.transforms[transformKey]
                if (!transform) return data
            }
            expression ||= this.app.transforms[transformKey][1]
            const bindings = {}, helperAliases = (this.env.options['application/x-jsonata']?.helpers ?? {})
            if (element) {
                if (transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)
                if (transform.includes('$this')) bindings.this = this.flatten(element)
                if (transform.includes('$root')) bindings.root = this.flatten((this.app.components.natives.get(element) ?? element).getRootNode())
                if (transform.includes('$host')) bindings.host = this.flatten((this.app.components.natives.get(element) ?? element).getRootNode().host)
                if (transform.includes('$document')) bindings.document = { ...this.flatten(document.documentElement), ...this.flatten(document) }
            }
            for (const a in helperAliases) if (this.app.helpers[helperAlias = helperAliases[a]] && transform.includes(`$${a}(`)) await this.loadHelper(helperAlias)
            for (const [k, v] of Object.entries(variableMap)) if (transform.includes(`$${k}`)) bindings[k] = typeof v === 'function' ? v : this.flatten(v)
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
            helpers: {}, libraries: {}, namespaces: {}, observers: new WeakMap(), regexp: {}, templates: {}, transforms: {}, types: {},
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
                const { vars } = envelope, { parentObjectName, useHelper } = vars
                if (useHelper && parentObjectName) await this.loadHelper(parentObjectName)
                for (const [i, a] of (vars.childArgs ?? []).entries()) try { vars.childArgs[i] = JSON.parse(a) } catch (e) { vars.childArgs[i] = a }
                for (const [i, a] of (vars.parentsArgs ?? []).entries()) try { vars.parentsArgs[i] = JSON.parse(a) } catch (e) { vars.parentsArgs[i] = a }
            },
            routerhash: async function (container, position, envelope) {
                const { signal } = envelope
                globalThis.addEventListener('hashchange', event => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash })), { signal })
            },
            selector: async function (container, position, envelope) {
                const { vars, signal } = envelope, { scope: scopeStatement, selector: selectorStatement } = vars, scope = this.resolveScope(scopeStatement, container)
                if (!scope) return {}
                let [selector, eventList] = selectorStatement.split('!').map(s => s.trim())
                if (eventList) eventList = eventList.split(',').map(s => s.trim()).filter(s => !!s)
                const eventNames = eventList ?? Array.from(new Set(Object.values(this.sys.defaultEventTypes).concat(['click'])))
                for (let eventName of eventNames) {
                    let keepDefault = eventName.endsWith('+')
                    if (keepDefault) eventName = eventName.slice(0, -1)
                    scope.addEventListener(eventName, event => {
                        if (selector.endsWith('}') && selector.includes('{')) {
                            const target = this.resolveSelector(selector, scope)
                            if (!target || (Array.isArray(target) && !target.length)) return
                        } else if (selector[0] === '$') {
                            if (selector.length === 1) return
                            const catchallSelector = this.buildCatchallSelector(selector)
                            if (!event.target.matches(catchallSelector)) return
                        } else if (selector && !event.target.matches(selector)) { return }
                        let tagDefaultEventType = event.target.constructor.events?.default ?? this.sys.defaultEventTypes[event.target.tagName.toLowerCase()] ?? 'click'
                        if (!eventList && (event.type !== tagDefaultEventType)) return
                        if (!keepDefault) event.preventDefault()
                        container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(event.target, undefined, event) }))
                    }, { signal })
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
                        items = target
                        break
                    case 'object':
                        if (Array.isArray(target)) target = Object.fromEntries(target)
                        for (const t of Object.values(target)) t[t.type] = t.type === 'field' ? this.getField(container, t.name) : this.getCell(t.name)
                        getReturnValue = () => {
                            const r = {}
                            for (const key in target) r[key] = target[key][target[key].type].get()
                            return Object.values(r).every(rr => rr == undefined) ? undefined : r
                        }
                        items = Object.values(target)
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
            json: async function (container, position, envelope, value) { return envelope.vars.value },
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
                const { vars, labels, env } = envelope, { useHelper, parentObjectName, parentArgs, childMethodName } = vars,
                    getArgs = (args, value, labels, env) => args.map(a => this.mergeVariables(a.trim(), value, labels, env))
                if (useHelper) return Promise.resolve(this.useHelper(parentObjectName, ...getArgs(parentArgs, value, labels, env)))
                if (childMethodName) {
                    const { childArgs } = vars
                    if (!(globalThis[parentObjectName] instanceof Object)) return
                    if (typeof globalThis[parentObjectName][childMethodName] !== 'function') return
                    return globalThis[parentObjectName][childMethodName](...getArgs(childArgs, value, labels, env))
                }
                return globalThis[parentObjectName](...getArgs(parentArgs, value, labels, env))
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
                    return document.location[k]
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
                    default:
                        if (value instanceof Object) for (const [k, v] of Object.entries(value)) if (v != undefined) target[k][target[k].type].set(v, target[k].mode)
                }
                return getReturnValue()
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
                const { labels, env, vars } = envelope, { expression } = vars,
                    useExpression = this.mergeVariables(expression, value, labels, env),
                    getResult = () => (override == null) ? value : this.mergeVariables(override.slice(0, -1).trim(), value, labels, env)
                let [mainWait, override] = useExpression.split('(')
                mainWait = this.mergeVariables(mainWait, value, labels, env)
                let ms = 0, now = Date.now()
                if (mainWait === 'frame') {
                    await new Promise(resolve => globalThis.requestAnimationFrame(resolve))
                    return getResult()
                } else if (globalThis.requestIdleCallback && mainWait.startsWith('idle')) {
                    const [, timeout] = mainWait.split(':')
                    await new Promise(resolve => globalThis.requestIdleCallback(resolve, { timeout: (parseInt(timeout) || -1) }))
                    return getResult()
                } else if (mainWait[0] === '+') {
                    ms = parseInt(mainWait.slice(1)) || 0
                } else if (this.sys.regexp.isNumeric.test(mainWait)) {
                    ms = (parseInt(mainWait) || 0) - now
                } else {
                    let mainWaitSplit = mainWait.split(':').map(s => s.trim())
                    if ((mainWaitSplit.length === 3) && mainWaitSplit.every(s => this.sys.regexp.isNumeric.test(s))) {
                        ms = Date.parse(`${(new Date()).toISOString().split('T')[0]}T${mainWait}Z`)
                        if (ms < 0) ms = (ms + (1000 * 3600 * 24))
                        ms = ms - now
                    } else {
                        ms = Date.parse(mainWait) - now
                    }
                }
                ms = Math.max(ms, 0)
                await new Promise(resolve => setTimeout(resolve, ms))
                return getResult()
            }
        }
    },
    sys: {
        value: Object.freeze({
            defaultEventTypes: Object.freeze({
                audio: 'loadeddata', body: 'load', details: 'toggle', dialog: 'close', embed: 'load', form: 'submit', iframe: 'load', img: 'load', input: 'change', link: 'load',
                meta: 'change', object: 'load', script: 'load', search: 'change', select: 'change', slot: 'slotchange', style: 'load', textarea: 'change', track: 'load', video: 'loadeddata'
            }),
            regexp: Object.freeze({
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g, classMatch: /(\.[a-zA-Z0-9\-]+)+/g,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi,
                splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g, tagMatch: /^[a-z0-9\-]+/g
            })
        })
    },

    activateTag: {
        value: async function (tag) {
            if (!tag || globalThis.customElements.get(tag) || !this.getCustomTag(tag)) return
            const [namespace, name] = tag.split('-'), namespaceBase = this.app.namespaces[namespace] ?? this.env.namespaces[namespace]
            if (!namespaceBase) return
            const id = `${namespaceBase}/${name}.html`
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
    generateUUIDWithNoDashes: {
        value: function () {
            return ([...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''))
        }
    },
    getCustomTag: {
        value: function (element) {
            return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
        }
    },
    getExports: {
        value: async function (url) {
            return url.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(url)))?.instance?.exports : (await import(url))
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
                case '[':
                    group = []
                    shape = 'array'
                    for (let t of expression.slice(1, -1).split(',')) {
                        t = t.trim()
                        if (!t) continue
                        const { name, mode, type } = canonicalizeName(t), index = group.push({ name, mode, type }) - 1
                        if (!parseOnly) group[index][type] = getStateTarget(name, mode, type)
                    }
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
                    return env.context[expression.slice(1)]
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
    mountFacet: {
        value: async function (facetContainer) {
            const { type, textContent } = facetContainer
            let src = facetContainer.getAttribute('src'), facetInstance, FacetClass, facetCid
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
                    FacetClass = (this.env.facets[src]?.prototype instanceof this.Facet) ? this.env.facets[src] : this.facetFactory(await import(this.resolveUrl(src)))
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
            await facetInstance.run(facetContainer, Object.freeze({ fields, cells, context }))
        }
    },
    renderWithTemplate: {
        value: function (element, data, tag, insertPosition, insertSelector, id, classList, attributeMap) {
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
            for (const n of nodesToApply) this.render(...n)
        }
    },
    resolveTemplateKey: {
        value: function (templateKey) {
            if (templateKey[0] === '`' && templateKey.endsWith('`')) {
                templateKey = templateKey.slice(1, -1)
                if (templateKey.startsWith('~/')) templateKey = `templates${templateKey.slice(1)}`
                if (templateKey.endsWith('.')) templateKey = `${templateKey}html`
            }
            return templateKey
        }
    },
    setGlobalNamespace: {
        enumerable: true, value: function () {
            if (!this.app._globalNamespace) {
                Object.defineProperty(this.app, '_globalNamespace', { value: crypto.randomUUID() })
                Object.defineProperty(globalThis, this.app._globalNamespace, { value: this })
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
            this.facetInstance.controller.abort()
        }
    },

    componentFactory: {
        value: async function (manifest, id) {
            let ComponentClass
            if (!(manifest.prototype instanceof this.Component)) {
                if (!this.isPlainObject(manifest)) return
                let extendsId
                if (manifest.extends) {
                    extendsId = this.resolveUrl(new URL(manifest.extends, document.location.href))
                    let extendsClass = this.app.components.classes[extendsId] ?? this.env.components[extendsId]
                    if (this.app.compile) extendsClass ??= await this.compileComponent(extendsId)
                }
                let style = manifest.style instanceof HTMLStyleElement ? manifest.style.cloneNode(true) : document.createElement('style'),
                    template = manifest.template instanceof HTMLTemplateElement ? manifest.template.cloneNode(true) : document.createElement('template')
                if (typeof manifest.style === 'string') style.textContent = manifest.style
                if (typeof manifest.template === 'string') template.content.textContent = manifest.template
                let classObj = manifest.class
                if (typeof classObj === 'string') {
                    this.setGlobalNamespace()
                    const classAsModuleUrl = URL.createObjectURL(new Blob([`const E = globalThis['${this.app._globalNamespace}']; export default ${classObj}`], { type: 'text/javascript' }))
                    classObj = (await import(classAsModuleUrl)).default
                    URL.revokeObjectURL(classAsModuleUrl)
                }
                ComponentClass = class extends (classObj?.prototype instanceof this.Component ? classObj : this.Component) {
                    static id = id
                    static extends = extendsId
                    static native = manifest.native
                    static style = style
                    static template = template
                }
            }
            ComponentClass.E = this
            ComponentClass.prototype.E = this
            return ComponentClass
        }
    },
    Component: {
        value: class extends globalThis.HTMLElement {
            static attributes = { observed: [] }
            static config = { openShadow: false }
            static events = { default: undefined }
            static extends
            static extendsBuiltIn
            static id
            static properties = { flattenable: this.observedAttributes ?? [], value: undefined }
            static style
            static subspaces = []
            static template
            constructor() {
                super()
                try {
                    this.shadowRoot || this.attachShadow({ mode: this.constructor.config.openShadow ? 'open' : 'closed' })
                    const shadowNodes = []
                    if (this.constructor.style) shadowNodes.push(this.constructor.style.cloneNode(true))
                    if (this.constructor.template) shadowNodes.push(...this.constructor.template.content.cloneNode(true).children)
                    this.shadowRoot.append(...shadowNodes)
                } catch (e) { }
            }
            static get observedAttributes() { return (super.observedAttributes || []).concat(...(this.attributes.observed ?? [])) }
            async connectedCallback() { }
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            valueOf() { return this.E.flatten(this) }
        }
    },

    facetFactory: {
        value: function (facetManifest) {
            if (facetManifest.prototype instanceof this.Facet) return facetManifest
            if (!this.isPlainObject(facetManifest)) return
            const { fieldNames, cellNames, statements, cid } = facetManifest
            const FacetClass = class extends this.Facet {
                static cid = cid
                static fieldNames = Array.from(fieldNames)
                static cellNames = Array.from(cellNames)
                static statements = statements
            }
            FacetClass.E = this
            return FacetClass
        }
    },
    Facet: {
        value: class {
            static E
            controller
            controllers = {}
            fields = {}
            vars = {}
            constructor() {
                this.controller = new AbortController()
                for (const fieldName of this.constructor.fieldNames) this.fields[fieldName] = this.constructor.E.getField(this, fieldName)
                Object.freeze(this.fields)
            }
            async run(container, env) {
                for (const [statementIndex, statement] of this.constructor.statements.entries()) {
                    const { steps = [] } = statement, labels = {}
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
                        container.addEventListener(stepIndex ? `done-${statementIndex}-${stepIndex - 1}` : 'run', async event => {
                            let detail = await this.constructor.E.handlers[handler](container, position, envelope, event.detail)
                            if (detail == undefined) {
                                if (typeof defaultExpression !== 'string') {
                                    detail = defaultExpression
                                } else if (((defaultExpression[0] === '"') && defaultExpression.endsWith('"')) || ((defaultExpression[0] === "'") && defaultExpression.endsWith("'"))) {
                                    detail = defaultExpression.slice(1, -1)
                                } else if (defaultExpression.match(this.constructor.E.sys.regexp.hasVariable)) {
                                    detail = this.constructor.E.mergeVariables(defaultExpression, undefined, labels, env)
                                } else if (defaultExpression.match(this.constructor.E.sys.regexp.isJSONObject) || defaultExpression.match(this.constructor.E.sys.regexp.isNumeric)
                                    || ['true', 'false', 'null'].includes(defaultExpression) || (defaultExpression[0] === '[' && defaultExpression.endsWith(']'))) {
                                    try {
                                        detail = JSON.parse(defaultExpression)
                                    } catch (e) {
                                        detail = defaultExpression
                                    }
                                } else {
                                    detail = defaultExpression
                                }
                            }
                            switch (label[0]) {
                                case '@':
                                    env.fields[label.slice(1)].set(detail, labelMode)
                                    break
                                case '#':
                                    env.cells[label.slice(1)].set(detail, labelMode)
                                    break
                                default:
                                    labels[label] = detail
                            }
                            labels[`${stepIndex}`] = detail
                            if (detail != undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                        }, { signal: this.controller.signal })
                    }
                }
                container.dispatchEvent(new CustomEvent('run'))
            }
        }
    }

})
ElementHTML.Component.E = ElementHTML
for (const scope of ['helpers', 'loaders']) for (const n in ElementHTML.env[scope]) ElementHTML.env[scope][n] = ElementHTML.env[scope][n].bind(ElementHTML)
const metaUrl = new URL(import.meta.url), metaOptions = metaUrl.searchParams, flagPromises = []
for (const flag of ['compile', 'dev', 'expose']) if (metaOptions.has(flag)) flagPromises.push(ElementHTML[flag[0].toUpperCase() + flag.slice(1)](metaOptions.get(flag)))
await Promise.all(flagPromises)
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