const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '1.2.0' },

    env: {
        enumerable: true, value: {
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
                    for (const [helperAlias, helperName] of Object.entries(this.env.options['application/x-jsonata']?.helpers ?? {})) {
                        if (text.includes(`$${helperAlias}(`)) expression.registerFunction(helperAlias, (...args) => this.useHelper(helperName, ...args))
                    }
                    return expression
                },
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
                    await Promise.all(Object.entries(this.env.options['application/x-jsonata']?.helpers ?? {}).map(entry => this.loadHelper(entry[1])))
                },
                'ipfs://': async function () {
                    if (this.env.options['ipfs://']?.gateway) return
                    try {
                        if ((await fetch('https://ipfs.tech.ipns.localhost:8080/', { method: 'HEAD' })).ok) {
                            this.env.options ||= {}
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
            namespaces: {}, options: {}, preload: {}, regexp: {}, templates: {}, transforms: {}, types: {}
        }
    },

    Dev: {
        enumerable: true, value: function () {
            this.env.errors = true
        }
    },
    Expose: {
        enumerable: true, value: function (name = 'E') {
            window[name && typeof name === 'string' ? name : 'E'] ||= this
        }
    },
    ImportPackage: {
        enumerable: true, value: async function (packageObject, packageUrl, packageKey) {
            let packageContents = packageObject?.default ?? {}
            if (!packageContents || (typeof packageContents !== 'object')) return
            if (packageContents?.hooks?.preInstall === 'function') packageContents = await packageContents.hooks.preInstall(packageContents, this)
            const getExports = async url => url.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(url)))?.instance?.exports : (await import(url))
            for (const a of ['helpers', 'loaders', 'templates', 'facets']) {
                if (typeof packageContents[a] !== 'string') continue
                const importUrl = this.resolveUrl(packageContents[a], packageUrl), exports = getExports(importUrl)
                packageContents[a] = {}
                if (!exports || (typeof exports !== 'object')) continue
                for (const aa in exports) {
                    if (!exports[aa]) continue
                    let typeCheck
                    switch (a) {
                        case 'facets':
                            typeCheck = (exports[aa].prototype instanceof this.Facet)
                            break
                        case 'templates':
                            typeCheck = ((typeof exports[aa] === 'string') || (exports[aa] instanceof HTMLElement))
                            break
                        default:
                            typeCheck = (typeof exports[aa] === 'function')
                    }
                    if (typeCheck) packageContents[a][aa] = exports[aa]
                }
            }
            for (const a in this.env) if (packageContents[a] && typeof packageContents[a] === 'object') {
                switch (a) {
                    case 'options':
                        for (const aa in (packageContents.options ?? {})) {
                            if (this.env.options[aa] && typeof this.env.options[aa] === 'object') {
                                for (const aaa in packageContents.options[aa]) {
                                    if (this.env.options[aa][aaa] && typeof this.env.options[aa][aaa] === 'object') {
                                        Object.assign(this.env.options[aa][aaa], packageContents.options[aa][aaa])
                                    } else {
                                        this.env.options[aa][aaa] = packageContents.options[aa][aaa] && typeof packageContents.options[aa][aaa] === 'object'
                                            ? { ...packageContents.options[aa][aaa] } : packageContents.options[aa][aaa]
                                    }
                                }
                            } else {
                                this.env.options[aa] = packageContents.options[aa] && typeof packageContents.options[aa] === 'object' ? { ...packageContents.options[aa] } : packageContents.options[aa]
                            }
                        }
                        break
                    case 'helpers': case 'loaders': case 'facets':
                        for (const aa in packageContents[a]) {
                            if (!packageContents[a][aa]) continue
                            switch (typeof packageContents[a][aa]) {
                                case 'function':
                                    this.env[a][aa] = packageContents[a][aa]
                                    break
                                case `string`:
                                    const importUrl = this.resolveUrl(packageContents[a][aa], packageUrl), exports = getExports(importUrl)
                                    this.env[a][aa] = typeof exports === 'function' ? exports : (typeof exports[aa] === 'function' ? exports[aa] : (typeof exports.default === 'function' ? exports.default : undefined))
                            }
                            if (a === 'facets' && packageContents[a][aa] && (typeof packageContents[a][aa] === 'object')) {
                                this.env[a][aa] = class extends this.Facet {
                                    static E = this
                                    static fieldNames = Array.from(packageContents[a][aa].fieldNames ?? [])
                                    static cellNames = Array.from(packageContents[a][aa].cellNames ?? [])
                                    static statements = packageContents[a][aa].statements ?? []
                                    static hash = packageContents[a][aa].hash
                                }
                            }
                        }
                        break
                    case 'templates':
                        for (const key in packageContents.templates) {
                            if ((typeof packageContents.templates[key] === 'string') && (packageContents.templates[key][0] === '`' && packageContents.templates[key].slice(-1) === '`')) {
                                let templateUrl = this.resolveTemplateKey(packageContents.templates[key])
                                this.env.templates[key] = ('`' + this.resolveUrl(templateUrl, packageUrl) + '`')
                            } else {
                                this.env.templates[key] = packageContents.templates[key]
                            }
                        }
                        break
                    case 'namespaces':
                        for (const namespace in packageContents.namespaces) {
                            this.env.namespaces[namespace] = this.resolveUrl(packageContents.namespaces[namespace], packageUrl)
                            if (this.env.namespaces[namespace].endsWith('/')) this.env.namespaces[namespace] = this.env.namespaces[namespace].slice(0, -1)
                        }
                        break
                    case 'hooks':
                        break
                    default:
                        Object.assign(this.env[a], packageContents[a])
                }
            }
            if (!this.env.namespaces[packageKey]) this.env.namespaces[packageKey] ||= `${this.resolveUrl('../', packageUrl)}components`
            if (packageContents?.hooks?.postInstall === 'function') packageContents.hooks.postInstall(packageContents, this)
        }
    },

    load: {
        enumerable: true, value: async function (rootElement = undefined, preload = []) {
            if (!rootElement) {
                if (this.app._globalNamespace) return
                this.app._globalNamespace = crypto.randomUUID()
                Object.defineProperty(window, this.app._globalNamespace, { value: ElementHTML })
                if (Object.keys(this.env.types).length) {
                    this.env.options ||= {}
                    this.env.options['application/x-jsonata'] ||= {}
                    this.env.options['application/x-jsonata'].helpers ||= {}
                    this.env.options['application/x-jsonata'].helpers.is = 'application/schema+json'
                }
                if (preload?.length) for (const p of preload) this.env.preload[`${p}://`] ||= null
                for (const hn in this.env.preload) if ((typeof this.env.loaders[hn] === 'function')) await this.loadHelper(hn, this.env.preload[hn])
                for (const a in this.env) Object.freeze(this.env[a])
                Object.freeze(this.env)
                for (const f of ['binders', 'handlers', 'parsers']) {
                    for (const b in this[f]) this[f][b] = this[f][b].bind(this)
                    Object.freeze(this[f])
                }
                Object.freeze(this)
                if (!this.env.errors) {
                    console.log = () => { }
                    window.addEventListener('unhandledrejection', event => event.preventDefault())
                }
                this.encapsulateNative()
            } else {
                await this.activateTag(this.getCustomTag(rootElement), rootElement)
                const isAttr = rootElement.getAttribute('is')
                if (isAttr) {
                    const doppelDom = this.app.doppel.dom.set(rootElement, document.createElement(isAttr)).get(rootElement)
                    for (const a of rootElement.attributes) doppelDom.setAttribute(a.name, a.value)
                    if (rootElement.innerHTML != undefined) doppelDom.innerHTML = rootElement.innerHTML
                    doppelDom.E_native = rootElement
                    if (typeof doppelDom.connectedCallback === 'function') doppelDom.connectedCallback()
                    if (doppelDom.disconnectedCallback || doppelDom.adoptedCallback || doppelDom.attributeChangedCallback) {
                        this.app.doppel.observers.set(rootElement, new MutationObserver(async records => {
                            for (const record of records) {
                                switch (record.type) {
                                    case 'childList':
                                        for (const removedNode of (record.removedNodes ?? [])) {
                                            if (typeof doppelDom.disconnectedCallback === 'function') doppelDom.disconnectedCallback()
                                            if (typeof doppelDom.adoptedCallback === 'function' && removedNode.ownerDocument !== document) doppelDom.adoptedCallback()
                                        }
                                        break
                                    case 'attributes':
                                        const attrName = record.attributeName, attrOldValue = record.oldValue, attrNewValue = record.target.getAttribute(attrName)
                                        doppelDom.setAttribute(attrName, attrNewValue)
                                        if (typeof doppelDom.attributeChangedCallback === 'function') doppelDom.attributeChangedCallback(attrName, attrOldValue, attrNewValue)
                                        break
                                    case 'characterData':
                                        doppelDom.innerHTML = rootElement.innerHTML
                                        break
                                }
                            }
                        }))
                        this.app.doppel.observers.get(rootElement).observe(rootElement, { childList: true, subtree: false, attributes: true, attributeOldValue: true, characterData: true })
                    }
                }
                if (!rootElement.shadowRoot) return
            }
            const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
                observerRoot = rootElement || this.app
            for (const element of domTraverser.call(domRoot, '*')) if (this.isFacetContainer(element)) { this.mountFacet(element) } else if (this.getCustomTag(element)) { this.load(element) }
            observerRoot._observer ||= new MutationObserver(async records => {
                for (const record of records) {
                    for (const addedNode of (record.addedNodes || [])) {
                        if (this.isFacetContainer(addedNode)) { this.mountFacet(addedNode) } else if (this.getCustomTag(addedNode)) { this.load(addedNode) }
                        if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.getCustomTag(n)) this.load(n)
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
            })
            observerRoot._observer.observe(domRoot, { subtree: true, childList: true })
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

    digest: {
        enumerable: true, value: async function (str) {
            if (typeof str !== 'string') str = `${str}`
            return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))).map(b => b.toString(16).padStart(2, '0')).join('')
        }
    },
    dispatchCompoundEvent: {
        enumerable: true, value: async function (eventName, detail, element) {
            const event = new CustomEvent(eventName, { detail })
            return element.dispatchEvent(event) && (element.E_native?.dispatchEvent(event) || this.app.doppel.dom.get(element)?.dispatchEvent(event))
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
                if (Array.isArray(value.constructor.E_FlattenableProperties)) for (const p of value.constructor.E_FlattenableProperties) result[p] = value[p]
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
                if (value.constructor.E_ValueProperty) {
                    result._ = value[value.constructor.E_ValueProperty]
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
    getAllProperties: {
        enumerable: true, value: function (obj) {
            const properties = new Set()
            let currentObj = obj, temp
            while (currentObj !== null) Object.getOwnPropertyNames((temp = currentObj, currentObj = Object.getPrototypeOf(currentObj), temp)).forEach(prop => properties.add(prop))
            return properties
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
        enumerable: true, value: async function (facetInstanceOrContainer, fieldName) {
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
    loadHelper: {
        enumerable: true, value: async function (name) {
            if (typeof this.app.helpers[name] === 'function') return true
            if (typeof this.env.helpers[name] !== 'function') return false
            if (typeof this.env.loaders[name] === 'function') await this.env.loaders[name].bind(this)()
            if (typeof this.env.helpers[name] === 'function') return (this.app.helpers[name] = this.env.helpers[name].bind(this))
            return false
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
            element = element.E_native ?? element
            const tag = (element.getAttribute('is') || element.tagName).toLowerCase()
            if (typeof data !== 'object') {
                if (element.constructor.E_ValueProperty) {
                    try { return element[element.constructor.E_ValueProperty] = data } catch (e) { return }
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
                        if (!eventName) eventName = element.constructor.E_DefaultEventType ?? this.sys.defaultEventTypes[tag] ?? 'click'
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
            element = element.E_native ?? element
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
            element = element.E_native ?? element
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
                if (typeof this.env.helpers[helperName] === 'function') return this.env.helpers[helperName].bind(this)(hostpath)
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
            let expression
            if (this.app.transforms[transformKey] === true) {
                let waitCount = 0
                while ((waitCount <= 100) && (this.app.transforms[transformKey] === true)) {
                    await new Promise(resolve => window.requestIdleCallback ? window.requestIdleCallback(resolve, { timeout: 100 }) : setTimeout(resolve, 100))
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
                if (!expression) {
                    await this.loadHelper('application/x-jsonata')
                    expression = this.useHelper('application/x-jsonata', transform)
                }
                this.app.transforms[transformKey] = [transform, expression]
            } else {
                if (transformKey[0] === '`') [transform, expression] = this.app.transforms[transformKey]
                if (!transform) return data
            }
            expression ||= this.app.transforms[transformKey][1]
            const bindings = {}
            if (element) {
                if (transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)
                if (transform.includes('$this')) bindings.this = this.flatten(element)
                if (transform.includes('$root')) bindings.root = this.flatten((element.E_native ?? element).getRootNode())
                if (transform.includes('$host')) bindings.host = this.flatten((element.E_native ?? element).getRootNode().host)
                if (transform.includes('$document')) bindings.document = { ...this.flatten(document.documentElement), ...this.flatten(document) }
            }
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
    sortByInheritance: {
        enumerable: true, value: function (idList) {
            return Array.from(new Set(idList)).filter(t => this.extends[t]).sort((a, b) =>
                ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
                .map((v, i, a) => (i === a.length - 1) ? [v, this.extends[v]] : v).flat()
        }
    },
    useHelper: {
        enumerable: true, value: function (name, ...args) {
            if (typeof this.app.helpers[name] === 'function') return this.app.helpers[name](...args)
        }
    },

    _styles: { value: {} },
    _templates: { value: {} },
    app: {
        value: {
            cells: {},
            doppel: {
                dom: new WeakMap(), observers: new WeakMap()
            },
            eventTarget: new EventTarget(),
            facets: {
                classes: {}, instances: new WeakMap()
            },
            helpers: {}, libraries: {}, regexp: {}, templates: {}, transforms: {}, types: {},
        }
    },
    binders: {
        value: {
            pattern: async function (container, position, envelope) {
                const { vars } = envelope, { expression, regexp } = vars
                this.app.regexp[expression] ||= this.env.regexp[expression] ?? regexp
            },
            proxy: async function (container, position, envelope) {
                const { vars } = envelope, { useHelper, parentObjectName } = vars
                if (useHelper && parentObjectName) await this.loadHelper(parentObjectName)
            },
            routerhash: async function (container, position, envelope) {
                const { signal } = envelope
                window.addEventListener('hashchange', event => container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: document.location.hash })), { signal })
            },
            selector: async function (container, position, envelope) {
                const { vars, signal } = envelope, { scopeStatement, selectorStatement } = vars, scope = this.resolveScope(scopeStatement, container)
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
                        let tagDefaultEventType = event.target.constructor.E_DefaultEventType ?? this.sys.defaultEventTypes[event.target.tagName.toLowerCase()] ?? 'click'
                        if (!eventList && (event.type !== tagDefaultEventType)) return
                        if (!keepDefault) event.preventDefault()
                        container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(event.target, undefined, event) }))
                    }, { signal })
                }
                return { selector, scope }
            },
            state: async function (container, position, envelope) {
                const { signal, vars } = envelope, { expression, typeDefault } = vars
                let group = this.getStateGroup(expression, typeDefault, container),
                    config = expression[0] === '[' ? 'array' : (expression[0] === '{' ? 'object' : 'single'),
                    addedFields = new Set(), addedCells = new Set(), items = [], getReturnValue
                switch (config) {
                    case 'single':
                        (group.type === 'field' ? addedFields : addedCells).add(group[group.type].name)
                        getReturnValue = () => group[group.type].get()
                        items.push(group)
                        break
                    case 'array':
                        for (const g of group) (g.type === 'field' ? addedFields : addedCells).add(g[g.type].name)
                        getReturnValue = () => {
                            const r = group.map(g => g[g.type].get())
                            return r.some(rr => rr == undefined) ? undefined : r
                        }
                        items = group
                        break
                    default:
                        for (const g of Object.values(group)) (g.type === 'field' ? addedFields : addedCells).add(g[g.type].name)
                        getReturnValue = () => {
                            const r = {}
                            for (const name in group) r[name] = group[name][group[name].type].get()
                            return Object.values(r).every(rr => rr == undefined) ? undefined : r
                        }
                        items = Object.values(group)
                }
                for (const item of items) {
                    item[item.type].eventTarget.addEventListener('change', event => {
                        const detail = getReturnValue()
                        if (detail != undefined) container.dispatchEvent(new CustomEvent(`done-${position}`, { detail }))
                    }, { signal })
                }
                return { addedFields: Array.from(addedFields), addedCells: Array.from(addedCells), getReturnValue, config, group }
            }
        }
    },
    classes: { value: {} },
    constructors: { value: {} },
    extends: { value: {} },
    files: { value: {} },
    handlers: {
        value: {
            json: async function (container, position, envelope, value) { return envelope.vars.value },
            network: async function (container, position, envelope, value) {
                const { labels, env, vars } = envelope, { expression, expressionIncludesValueAsVariable, returnFullRequest } = vars
                let url = this.mergeVariables(expression, value, labels, env)
                if (!url) return
                const options = {}
                if (!((value == undefined) || (expressionIncludesValueAsVariable && typeof value === 'string'))) {
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
                const { vars } = envelope, { getReturnValue, config, group } = vars
                if (value == undefined) return getReturnValue()
                switch (config) {
                    case 'single':
                        group[group.type].set(value, group.mode)
                        break
                    case 'array':
                        if (Array.isArray(value)) for (const [i, v] of value.entries()) if ((v != undefined) && (group[i] != undefined)) group[i][group[i].type].set(v, group[i].mode)
                        break
                    default:
                        if (value instanceof Object) for (const [k, v] of Object.entries(value)) if (v != undefined && group[k]) group[k][group[k].type].set(v, group[k].mode)
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
                const { labels, env, vars } = envelope, { expression } = vars, getResult = () => {
                    const useExpression = this.mergeVariables(expression, value, labels, env)
                    let [mainWait, override] = useExpression.split('(')
                    mainWait = this.mergeVariables(mainWait, value, labels, env)
                    return (override == null) ? value : this.mergeVariables(override.slice(0, -1).trim(), value, labels, env)
                }
                let ms = 0, now = Date.now()
                if (mainWait === 'frame') {
                    await new Promise(resolve => window.requestAnimationFrame(resolve))
                    return getResult()
                } else if (window.requestIdleCallback && mainWait.startsWith('idle')) {
                    const [, timeout] = mainWait.split(':')
                    await new Promise(resolve => window.requestIdleCallback(resolve, { timeout: (parseInt(timeout) || -1) }))
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
    ids: { value: {} },
    scripts: { value: {} },
    styles: { value: {} },
    sys: {
        value: Object.freeze({
            defaultEventTypes: Object.freeze({
                audio: 'loadeddata', body: 'load', details: 'toggle', dialog: 'close', embed: 'load', form: 'submit', iframe: 'load', img: 'load', input: 'change', link: 'load',
                meta: 'change', object: 'load', script: 'load', search: 'change', select: 'change', slot: 'slotchange', style: 'load', textarea: 'change', track: 'load', video: 'loadeddata'
            }),
            regexp: Object.freeze({
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g, classMatch: /(\.[a-zA-Z0-9\-]+)+/g, extends: /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi,
                label: /^([\@\#]?[a-zA-Z0-9]+[\!\?]?):\s+/, defaultValue: /\s+\?\?\s+(.+)\s*$/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g, tagMatch: /^[a-z0-9\-]+/g
            })
        })
    },
    tags: { value: {} },
    templates: { value: {} },

    activateTag: {
        value: async function (tag, forceReload = false) {
            if (globalThis.customElements.get(tag)) return
            if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
            const id = this.getTagId(tag);
            [this.ids[tag], this.tags[id]] = [id, tag]
            const loadResult = await this.loadTagAssetsFromId(id, forceReload)
            if (!loadResult) return
            globalThis.customElements.define(tag, this.constructors[id], undefined)
        }
    },
    buildCatchallSelector: {
        value: function (selector) {
            const selectorMain = selector.slice(1)
            if (!selectorMain) return selector
            return `${selectorMain},[is="${selectorMain}"],e-${selectorMain},[is="e-${selectorMain}"]`
        }
    },
    canonicalizeDirectives: {
        value: function (directives) {
            directives = directives.trim()
            const canonicalizeDirectives = []
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                directive = directive.trim()
                if (!directive || (directive.slice(0, 3) === '|* ')) continue
                canonicalizeDirectives.push(directive.replace(this.sys.regexp.segmenter, ' >> ').trim())
            }
            return canonicalizeDirectives.join('\n').trim()
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
                this.tags[id] = Array.from(this.tags[id])
                this.tags[id].push(tag)
            }
            const classNames = Object.values(this.ids)
            for (const nc of Reflect.ownKeys(globalThis)) if (nc.startsWith('HTML') && nc.endsWith('Element')) this.ids[nc.replace('HTML', '').replace('Element', '').toLowerCase()] ||= nc
            delete this.ids.image;
            [this.ids[''], this.ids['HTMLElement']] = ['HTMLElement', 'HTMLElement']
            for (const id in this.ids) {
                this.classes[id] = globalThis[this.ids[id]]
                this.constructors[id] = this.ComponentFactory(this.classes[id])
            }
        }
    },
    getCustomTag: {
        value: function (element) {
            return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
        }
    },
    getStateGroup: {
        value: function (expression, typeDefault = '#', element) {
            element = this.app.doppel.get(element) ?? element
            let group
            const getStateTarget = (name) => {
                const modeFlag = name[name.length - 1],
                    mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
                if (mode) name = name.slice(0, -1).trim()
                if ((name[0] !== '#') && (name[0] !== '@')) name = `${typeDefault}${name}`
                switch (name[0]) {
                    case '#':
                        return { cell: this.getCell(name.slice(1)), type: 'cell', mode }
                    case '@':
                        return { field: this.getField(element, name.slice(1)), type: 'field', mode }
                }
            }
            switch (expression[0]) {
                case '{':
                    group = {}
                    for (const pair of expression.slice(1, -1).trim().split(',')) {
                        let [key, name] = pair.trim().split(':').map(s => s.trim())
                        if (!name) name = key
                        const keyEndsWith = key[key.length - 1]
                        if (keyEndsWith === '!' || keyEndsWith === '?') key = key.slice(0, -1)
                        group[key] = getStateTarget(name)
                    }
                    return group
                case '[':
                    group = []
                    for (let t of expression.slice(1, -1).split(',')) {
                        t = t.trim()
                        if (!t) continue
                        group.push(getStateTarget(t))
                    }
                    return group
                default:
                    expression = expression.trim()
                    if (!expression) return
                    return getStateTarget(expression)
            }
        }
    },
    isFacetContainer: {
        value: function (element) {
            return ((element instanceof HTMLScriptElement) && (element.type === 'directives/element' || element.type === 'application/element'))
        }
    },
    getInheritance: {
        value: function (id = 'HTMLElement') {
            const inheritance = [id]
            while (id && this.extends[id]) inheritance.push(id = this.extends[id])
            return inheritance
        }
    },
    getTagId: {
        value: function (tag) {
            if (this.ids[tag]) return this.ids[tag]
            let [namespace, ...pointer] = tag.split('-').map(t => t.toLowerCase()).filter(s => !!s)
            pointer = pointer.join('/')
            if (namespace === 'e') return (new URL(`./e/components/${pointer}.html`, import.meta.url)).href
            if (this.env.namespaces[namespace]) return (new URL(`${this.env.namespaces[namespace]}/${pointer}.html`, document.baseURI)).href
            return (new URL(`components/${namespace}/${pointer}.html`, document.baseURI)).href
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
                sanitizedScriptAsModule = `const ElementHTML = globalThis['${this.app._globalNamespace}']; export default ${sanitizedScript}`,
                sanitizedScriptAsUrl = URL.createObjectURL(new Blob([sanitizedScriptAsModule], { type: 'text/javascript' })),
                classModule = await import(sanitizedScriptAsUrl)
            URL.revokeObjectURL(sanitizedScriptAsUrl)
            this.classes[id] = classModule.default
            this.classes[id].id = id
            this.constructors[id] = class extends this.classes[id] { constructor() { super() } }
            return true
        }
    },
    mountFacet: {
        value: async function (facetContainer) {
            const { type, src, textContent } = facetContainer
            let facetInstance, FacetClass, facetId
            switch (type) {
                case 'directives/element':
                    const directives = this.canonicalizeDirectives(src ? await fetch(src).then(r => r.text()) : textContent)
                    if (!directives) break
                    facetId = await this.digest(directives)
                    this.app.facets.classes[facetId] ??= await this.compileFacet(directives, facetId)
                    break
                case 'application/element':
                    if (!src) break
                    switch (src[0]) {
                        case '$':
                            this.app.facets.classes[facetId] ??= this.env.facets[src.slice(1)]
                            break
                        default:
                            this.app.facets.classes[facetId] ??= await import(facetId)
                            break
                    }
                    break
            }
            FacetClass = this.app.facets.classes[facetId]
            if (!FacetClass || !(FacetClass.prototype instanceof this.Facet)) return
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
    sliceAndStep: {
        value: function (sig, list) {
            let [start = 0, end = list.length, step = 0] = sig.split(':').map(s => (parseInt(s) || 0))
            if (end === 0) end = list.length
            list = list.slice(start, end)
            if (!step) return list
            return (step === 1) ? list.filter((v, i) => (i + 1) % 2) : list.filter((v, i) => (i + 1) % step === 0)
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
                            } else {
                                target = template.content.querySelector('slot:not([name])')
                            }
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
    unmountFacet: {
        value: function (facetContainer) {
            const facetInstance = this.app.facets.instances.get(facetContainer)
            for (const [k, v] of Object.entries((facetInstance.controllers))) v.abort()
            this.facetInstance.controller.abort()
        }
    },

    ComponentFactory: {
        value: function (baseClass = globalThis.HTMLElement) {
            return class Component extends globalThis.HTMLElement {
                constructor() {
                    super()
                    Object.defineProperty(this, 'E', { value: ElementHTML })
                    Object.defineProperty(this, 'E_baseClass', { value: baseClass })
                    Object.defineProperty(this, 'E_emitValueChange', {
                        value: function (value, eventName, bubbles = true, cancelable = true, composed = false) {
                            if (!eventName) eventName = this.constructor.E_DefaultEventType ?? this.E.sys.defaultEventTypes[this.tagName.toLowerCase()] ?? 'click'
                            this.dispatchEvent(new CustomEvent(eventName, { detail: value, bubbles, cancelable, composed }))
                            return value
                        }
                    })
                    try {
                        this.shadowRoot || this.attachShadow({ mode: this.constructor.E_ShadowMode ?? 'open' })
                        this.shadowRoot.textContent = ''
                        this.shadowRoot.appendChild(document.createElement('style')).textContent = ElementHTML._styles[this.constructor.id] ?? ElementHTML.stackStyles(this.constructor.id)
                        const templateNode = document.createElement('template')
                        templateNode.innerHTML = ElementHTML._templates[this.constructor.id] ?? ElementHTML.stackTemplates(this.constructor.id) ?? ''
                        this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
                    } catch (e) { }
                }
                static get observedAttributes() { return [] }
                static get E_FlattenableProperties() { return this.observedAttributes }
                static E = ElementHTML
                async connectedCallback() { }
                attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
                valueOf() { return this.E.flatten(this) }
            }
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
                    const { steps = [] } = statement, labels = { ...(statement.labels ?? {}) }
                    for (const [stepIndex, step] of steps.entries()) {
                        const position = `${statementIndex}-${stepIndex}`, { label, labelMode, handler, binder, defaultExpression: defaultValue } = step,
                            envelope = { labels: { ...labels }, env }
                        this.vars[position] = { ...(step.vars ?? {}) }
                        if (binder) {
                            if (this.vars[position].signal) {
                                this.controllers[position] = new AbortController()
                                envelope.signal = this.controllers[position].signal
                            }
                            Object.assign(this.vars[position], await this.constructor.E.binders[binder](container, position, envelope))
                        }
                        envelope.vars = this.vars[position]
                        container.addEventListener(stepIndex ? `done-${statementIndex}-${stepIndex - 1}` : 'run', async event => {
                            let detail = await this.constructor.E.handlers[handler](container, position, envelope, event.detail)
                            if (detail == undefined) {
                                if (typeof defaultValue !== 'string') {
                                    detail = defaultValue
                                } else if (((defaultValue[0] === '"') && defaultValue.endsWith('"')) || ((defaultValue[0] === "'") && defaultValue.endsWith("'"))) {
                                    detail = defaultValue.slice(1, -1)
                                } else if (defaultValue.match(this.constructor.E.sys.regexp.hasVariable)) {
                                    detail = this.constructor.E.mergeVariables(defaultValue, undefined, labels, env)
                                } else if (defaultValue.match(this.constructor.E.sys.regexp.isJSONObject) || defaultValue.match(this.constructor.E.sys.regexp.isNumeric)
                                    || ['true', 'false', 'null'].includes(defaultValue) || (defaultValue[0] === '[' && defaultValue.endsWith(']'))) {
                                    try {
                                        detail = JSON.parse(defaultValue)
                                    } catch (e) {
                                        detail = defaultValue
                                    }
                                } else {
                                    detail = defaultValue
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
                            if (detail != undefined) container.dispatchEvent(new CustomEvent(`done-${statementIndex}-${stepIndex}`, { detail }))
                        }, { signal: this.controller.signal })
                    }
                }
                container.dispatchEvent(new CustomEvent('run'))
            }
        }
    },

    /* begin compile module */
    compileFacet: {
        value: async function (directives, hash, raw) {
            if (raw) directives = this.canonicalizeDirectives(directives)
            const fieldNames = new Set(), cellNames = new Set(), statements = []
            let statementIndex = -1
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                statementIndex = statementIndex + 1
                const statement = { labels: {}, steps: [] }
                let stepIndex = -1
                for (let [index, segment] of directive.split(' >> ').entries()) {
                    segment = segment.trim()
                    if (!segment) continue
                    let handlerExpression = segment, label, defaultExpression, hasDefault = false
                    const step = {}, labelMatch = handlerExpression.match(this.sys.regexp.label)
                    if (labelMatch) {
                        label = labelMatch[1].trim()
                        handlerExpression = handlerExpression.slice(labelMatch[0].length).trim()
                    }
                    const defaultExpressionMatch = handlerExpression.match(this.sys.regexp.defaultValue)
                    if (defaultExpressionMatch) {
                        defaultExpression = defaultExpressionMatch[1].trim()
                        handlerExpression = handlerExpression.slice(0, defaultExpressionMatch.index).trim()
                        hasDefault = !!defaultExpression
                        if (defaultExpression[0] === '#') {
                            const cn = defaultExpression.slice(1).trim()
                            if (cn) cellNames.add(cn)
                        }
                    }
                    label ||= `${index}`
                    const labelModeFlag = label[label.length - 1], labelMode = labelModeFlag === '!' ? 'force' : ((labelModeFlag === '?') ? 'silent' : undefined)
                    if (labelMode) {
                        label = label.slice(0, -1).trim()
                        step.labelMode = labelMode
                    }
                    step.label = label
                    switch (label[0]) {
                        case '@':
                            let fn = label.slice(1).trim()
                            if (fn) fieldNames.add(fn)
                            break
                        case '#':
                            const cn = label.slice(1).trim()
                            if (cn) cellNames.add(cn)
                            break
                        default:
                            const ln = label.trim()
                            if (ln) statement.labels[ln] = undefined
                    }
                    let parsed
                    stepIndex = stepIndex + 1
                    switch (handlerExpression) {
                        case '#': case '?': case '/': case ':':
                            parsed = this.parsers.router(handlerExpression, hasDefault)
                            break
                        default:
                            switch (handlerExpression[0]) {
                                case '`':
                                    parsed = this.parsers.proxy(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case '/':
                                    parsed = this.parsers.pattern(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case '"': case "'":
                                    parsed = this.parsers.string(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case "#": case "@":
                                    parsed = this.parsers.state(handlerExpression, hasDefault)
                                    for (const addedName of (parsed.vars.addedFieldNames ?? [])) fieldNames.add(addedName)
                                    for (const addedName of (parsed.vars.addedCellNames ?? [])) cellNames.add(addedName)
                                    break
                                case "$":
                                    if (handlerExpression[1] === "{") {
                                        parsed = this.parsers.variable(handlerExpression, hasDefault)
                                    } else if (handlerExpression[1] === "(") {
                                        parsed = this.parsers.selector(handlerExpression.slice(2, -1), hasDefault)
                                    }
                                    break
                                case "(":
                                    parsed = this.parsers.transform(handlerExpression, hasDefault)
                                    break
                                case "{": case "[":
                                    parsed = this.parsers.json(handlerExpression, hasDefault)
                                    break
                                case "n": case "t": case "f": case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "7": case "9":
                                    let t
                                    switch (handlerExpression) {
                                        case 'null': case 'true': case 'false':
                                            t = true
                                        default:
                                            if (t || handlerExpression.match(this.sys.regexp.isNumeric)) parsed = this.parsers.json(handlerExpression, hasDefault)
                                    }
                                    break
                                case "_":
                                    if (handlerExpression.endsWith('_')) {
                                        parsed = this.parsers.wait(handlerExpression.slice(1, -1), hasDefault)
                                        break
                                    }
                                case '~':
                                    if (handlerExpression.endsWith('~')) handlerExpression = handlerExpression.slice(1, -1)
                                default:
                                    parsed = this.parsers.network(handlerExpression, hasDefault)
                            }
                    }
                    let { vars, binder, handler } = parsed
                    if (vars) step.vars = vars
                    if (binder) step.binder = binder
                    step.handler = handler
                    if (defaultExpression) step.defaultExpression = defaultExpression
                    statement.labels[label] = undefined
                    statement.labels[`${index}`] = undefined
                    statement.steps.push(Object.freeze(step))
                }
                Object.seal(statement.labels)
                Object.freeze(statement.steps)
                Object.freeze(statement)
                statements.push(statement)
            }
            hash ??= await this.digest(directives)
            const FacetClass = class extends this.Facet {
                static E = ElementHTML
                static fieldNames = Array.from(fieldNames)
                static cellNames = Array.from(cellNames)
                static statements = statements
                static hash = hash
            }
            return FacetClass
        }
    },
    parsers: {
        value: {
            json: function (expression, hasDefault) {
                let value = null
                try { value = JSON.parse(expression) } catch (e) { }
                return { vars: { value }, handler: 'json' }
            },
            network: function (expression, hasDefault) {
                const expressionIncludesValueAsVariable = (expression.includes('${}') || expression.includes('${$}'))
                let returnFullRequest
                if (expression[0] === '~' && expression.endsWith('~')) {
                    returnFullRequest = true
                    expression = expression.slice(1, -1)
                }
                return { vars: { expression, expressionIncludesValueAsVariable, returnFullRequest, hasDefault }, handler: 'network' }
            },
            pattern: function (expression, hasDefault) {
                expression = expression.trim()
                if (!expression) return
                return { vars: { expression, regexp: this.env.regexp[expression] ?? new RegExp(expression) }, binder: 'pattern', handler: 'pattern' }
            },
            proxy: function (expression, hasDefault) {
                const [parentExpression, childExpression] = expression.split('.').map(s => s.trim())
                if (!parentExpression || (childExpression === '')) return
                let [parentObjectName, ...parentArgs] = parentExpression.split('(').map(s => s.trim())
                parentArgs = parentArgs.join('(').slice(0, -1).trim().split(',').map(s => s.trim())
                let useHelper = parentObjectName[0] === '~', childMethodName, childArgs
                if (useHelper) {
                    parentObjectName = parentObjectName.slice(1)
                } else {
                    [childMethodName, ...childArgs] = childExpression.split('(').map(s => s.trim())
                    childArgs = childArgs.join('(').slice(0, -1).trim().split(',').map(s => s.trim())
                }
                return { vars: { useHelper, parentObjectName, parentArgs, childMethodName, childArgs }, binder: 'proxy', handler: 'proxy' }
            },
            router: function (expression, hasDefault) {
                let vars, binder, handler
                switch (expression) {
                    case '#':
                        vars = { signal: true }
                        binder = 'routerhash'
                        handler = 'routerhash'
                        break
                    case '?':
                        handler = 'routersearch'
                        break
                    case '/':
                        handler = 'routerpathname'
                        break
                    case ':':
                        handler = 'router'
                }
                return { vars, binder, handler }
            },
            selector: function (expression, hasDefault) {
                if (!expression.includes('|')) {
                    switch (expression[0]) {
                        case '#':
                            expression = `:document|${expression}`
                            break
                        case '@':
                            expression = `:root|[name="${expression.slice(1)}"]`
                            break
                        case '^':
                            expression = `:root|[style~="${expression.slice(1)}"]`
                            break
                        case '~':
                            expression = `:root|[itemscope] [itemprop="${expression.slice(1)}"]`
                            break
                        case '.':
                        default:
                            expression = `:root|${expression}`
                    }
                }
                const [scopeStatement, selectorStatement] = expression.split('|').map(s => s.trim())
                return { vars: { scopeStatement, selectorStatement, signal: true }, binder: 'selector', handler: 'selector' }
            },
            state: function (expression, hasDefault) {
                return { vars: { expression: expression.slice(1), signal: true, typeDefault: expression[0] }, binder: 'state', handler: 'state' }
            },
            string: function (expression, hasDefault) {
                return { vars: { expression }, handler: 'string' }
            },
            transform: function (expression, hasDefault) {
                if (expression && expression.startsWith('(`') && expression.endsWith('`)')) expression = expression.slice(1, -1)
                if (expression.startsWith('`~/')) expression = '`transforms' + expression.slice(2)
                if (expression.endsWith('.`')) expression = expression.slice(0, -1) + 'jsonata`'
                return { vars: { expression }, handler: 'transform' }
            },
            variable: function (expression, hasDefault) {
                return { vars: { expression }, handler: 'variable' }
            },
            wait: function (expression, hasDefault) {
                return { vars: { expression }, handler: 'wait' }
            }
        }
    },
    /* end compile module */

    /* start dev module */
    exportFacet: {
        value: async function (source) {
            const facetSignature = { fieldNames: [], cellNames: [], statements: [], hash: undefined }
            if (!source) return facetSignature
            let facetClass
            switch (typeof source) {
                case 'string':
                    facetClass = this.app.facets.classes[source] ?? this.env.facets[source]
                case 'function':
                    facetClass ??= source
                case 'object':
                    if (source instanceof HTMLElement) facetClass ??= this.app.facets.instances.get(source)?.constructor
                    if (facetClass) for (const p in facetSignature) facetSignature[p] = facetClass[p]
            }
            return facetSignature
        }
    },


    /* end dev module */

})
const metaUrl = new URL(import.meta.url), metaOptions = metaUrl.searchParams
if (metaOptions.has('packages')) {
    const importmapElement = document.head.querySelector('script[type="importmap"]')
    let importmap = { imports: {} }
    if (importmapElement) try { importmap = JSON.parse(importmapElement.textContent.trim()) } catch (e) { }
    const imports = importmap.imports ?? {}, importPromises = {}, importKeys = {}
    for (const p of metaOptions.get('packages').split(',').map(s => s.trim()).filter(s => !!s)) {
        let importUrl
        if ((typeof imports[p] === 'string') && imports[p].includes('/')) {
            if (imports[p].endsWith('/')) imports[p] = `${imports[p]}package.js`
            importUrl = imports[p]
        } else {
            importUrl = `ipfs://${p}/package.js`
        }
        const [protocol,] = value.split('://')
        if (protocol !== value) {
            const helperName = `${protocol}://`
            if (typeof ElementHTML.env.loaders[helperName] === 'function') await ElementHTML.env.loaders[helperName].bind(ElementHTML)()
        }
        importUrl = ElementHTML.resolveUrl(importUrl)
        if (!importUrl) continue
        importPromises[importUrl] = import(importUrl)
        importKeys[importUrl] = p
    }
    await Promise.all(Object.values(importPromises))
    for (const url in importPromises) await ElementHTML.ImportPackage(await importPromises[url], url, importKeys[url])
}
if (metaOptions.has('dev')) ElementHTML.Dev(metaOptions.get('dev'))
if (metaOptions.has('expose')) ElementHTML.Expose(metaOptions.get('expose'))
if (metaOptions.has('load')) await ElementHTML.load(undefined, (metaOptions.get('load') || '').split(',').map(s => s.trim()).filter(s => !!s))
export { ElementHTML }