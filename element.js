const ElementHTML = Object.defineProperties({}, {

    version: { enumerable: true, value: '1.1.1' },

    sys: {
        value: Object.freeze({
            defaultEventTypes: Object.freeze({
                audio: 'loadeddata', body: 'load', details: 'toggle', dialog: 'close', embed: 'load', form: 'submit', iframe: 'load', img: 'load', input: 'change', link: 'load',
                meta: 'change', object: 'load', script: 'load', search: 'change', select: 'change', slot: 'slotchange', style: 'load', textarea: 'change', track: 'load', video: 'loadeddata'
            }),
            regexp: Object.freeze({
                attrMatch: /\[[a-zA-Z0-9\-\= ]+\]/g, classMatch: /(\.[a-zA-Z0-9\-]+)+/g, extends: /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/,
                hasVariable: /\$\{(.*?)\}/g, htmlBlocks: /<html>\n+.*\n+<\/html>/g, htmlSpans: /<html>.*<\/html>/g, idMatch: /(\#[a-zA-Z0-9\-]+)+/g,
                isDataUrl: /data:([\w/\-\.]+);/, isFormString: /^\w+=.+&.*$/, isJSONObject: /^\s*{.*}$/, isNumeric: /^[0-9\.]+$/, isTag: /(<([^>]+)>)/gi, tagMatch: /^[a-z0-9\-]+/g
            })
        })
    },
    app: {
        value: {
            cells: {}, helpers: {}, libraries: {}, regexp: {}, templates: {}, transforms: {}, types: {}
        }
    },
    env: {
        enumerable: true, value: {
            context: {},
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
                    for (const [helperAlias, helperName] of Object.entries(this.env.options?.jsonata?.helpers ?? {})) {
                        if (text.includes(`$${helperAlias}(`)) expression.registerFunction(helperAlias, (...args) => this.useHelper(helperName, ...args))
                    }
                    return expression
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
                    await Promise.all(Object.entries(this.env.options?.jsonata?.helpers ?? {}).map(entry => this.loadHelper(entry[1])))
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
            namespaces: {}, options: {}, regexp: {}, templates: {}, transforms: {}, types: {}
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
        enumerable: true, value: async function (packageObject, packageUrl, packageKey) {
            let packageContents = packageObject?.default ?? {}
            if (!packageContents) return
            for (const a of ['gateways', 'helpers', 'loaders']) {
                if (typeof packageContents[a] !== 'string') continue
                const importUrl = this.resolveUrl(packageContents[a], packageUrl)
                let exports = importUrl.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(importUrl)))?.instance?.exports : (await import(importUrl))
                packageContents[a] = {}
                if (!exports || (typeof exports !== 'object')) continue
                for (const aa in exports) if (typeof exports[aa] === 'function') packageContents[a][aa] = exports[aa]
            }
            if (typeof packageContents.templates === 'string') {
                const importUrl = this.resolveUrl(packageContents.templates, packageUrl)
                let exports = importUrl.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(importUrl)))?.instance?.exports : (await import(importUrl))
                packageContents.templates = {}
                if (exports && (typeof exports === 'object')) for (const aa in exports) if ((typeof exports[aa] === 'string') || (exports[aa] instanceof HTMLElement)) packageContents.templates[aa] = exports[aa]
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
                    case 'gateways': case 'helpers': case 'loaders':
                        for (const aa in packageContents[a]) {
                            switch (typeof packageContents[a][aa]) {
                                case 'function':
                                    this.env[a][aa] = packageContents[a][aa]
                                    break
                                case `string`:
                                    const importUrl = this.resolveUrl(packageContents[a][aa], packageUrl)
                                    let exports = importUrl.endsWith('.wasm') ? (await WebAssembly.instantiateStreaming(fetch(importUrl))).instance.exports : (await import(importUrl))
                                    this.env[a][aa] = typeof exports === 'function' ? exports : (typeof exports[aa] === 'function' ? exports[aa] : (typeof exports.default === 'function' ? exports.default : undefined))
                            }
                        }
                        break
                    case 'templates':
                        for (const key in packageContents.templates) {
                            if ((typeof packageContents.templates[key] === 'string') && (packageContents.templates[key][0] === '`' && packageContents.templates[key].slice(-1) === '`')) {
                                this.env.templates[key] = [packageContents.templates[key].slice(1, -1), packageUrl]
                            } else {
                                this.env.templates[key] = packageContents.templates[key]
                            }
                        }
                        break
                    case 'namespaces':
                        for (const namespace in packageContents.namespaces) this.env.namespaces[namespace] = this.resolveUrl(packageContents.namespaces[namespace], packageUrl)
                        break
                    default:
                        Object.assign(this.env[a], packageContents[a])
                }
            }
            if (!this.env.namespaces[packageKey]) this.env.namespaces[packageKey] ||= `${this.resolveUrl('../', packageUrl)}components`
        }
    },

    load: {
        enumerable: true, value: async function (rootElement = undefined) {
            if (!rootElement) {
                if (this.app._globalNamespace) return
                this.app._globalNamespace = crypto.randomUUID()
                Object.defineProperty(window, this.app._globalNamespace, { value: ElementHTML })
                if (Object.keys(this.env.types).length) {
                    this.env.options ||= {}
                    this.env.options.jsonata ||= {}
                    this.env.options.jsonata.helpers ||= {}
                    this.env.options.jsonata.helpers.is = 'application/schema+json'
                }
                for (const a in this.env) Object.freeze(this.env[a])
                Object.freeze(this.env)
                Object.freeze(this)
                if (!this.env.errors) console.log = () => { }
                this.encapsulateNative()
            }
            rootElement && await this.activateTag(this.getCustomTag(rootElement), rootElement)
            if (rootElement && !rootElement.shadowRoot) return
            const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
                observerRoot = rootElement || this.app
            for (const element of domTraverser.call(domRoot, '*')) if (this.getCustomTag(element)) this.load(element)
            observerRoot._observer ||= new MutationObserver(async records => {
                for (const record of records) for (const addedNode of (record.addedNodes || [])) {
                    if (this.getCustomTag(addedNode)) this.load(addedNode)
                    if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.getCustomTag(n)) this.load(n)
                }
            })
            observerRoot._observer.observe(domRoot, { subtree: true, childList: true })
            Object.freeze(this.app)
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
            if (typeof value !== 'object') return value
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
                if ('id' in value) result.id = value.id
                if ('name' in value) result.name = value.name
                if ('value' in value) result.value = value.value
                if ('checked' in value) result.checked = value.checked
                if ('selected' in value) result.selected = value.selected
                for (const c of Object.keys(classList)) result[`&${c}`] = true
                for (const ent of Object.entries(style)) result[`^${ent[0]}`] = ent[1]
                if (value.constructor.E_FlattenableProperties && Array.isArray(value.constructor.E_FlattenableProperties)) {
                    for (const p of value.constructor.E_FlattenableProperties) result[p] = value[p]
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
                result._closest = {
                    id: value.closest('[id]')?.id,
                    name: value.closest('[name]')?.name,
                    class: value.closest('[class]')?.getAttribute('class'),
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
            if (value instanceof Response) return { body: this.E.parse(value), ok: value.ok, status: value.status, headers: Object.fromEntries(value.headers.entries()) }
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
    getStateGroup: {
        enumerable: true, value: function (expression, type = '#', element) {
            let group
            const getStateTarget = (name) => {
                const modeFlag = name[name.length - 1],
                    mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
                if (mode) name = name.slice(0, -1).trim()
                switch (name[0]) {
                    case '#':
                        return [this.getCell(name.slice(1)), mode]
                    case '%':
                        return [element.getField(name.slice(1)), mode]
                    default:
                        return [type === '%' ? element.getField(name) : this.getCell(name), mode]
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
                    return [getStateTarget(expression)]
            }
        }
    },
    loadHelper: {
        enumerable: true, value: async function (name) {
            if (typeof this.app.helpers[name] === 'function') return
            if (typeof this.env.helpers[name] !== 'function') return
            if (typeof this.env.loaders[name] === 'function') await this.env.loaders[name].bind(this)()
            if (typeof this.env.helpers[name] === 'function') this.app.helpers[name] = this.env.helpers[name].bind(this)
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
            await this.loadHelper(contentType)
            return this.useHelper(contentType, text) ?? text
        }
    },
    render: {
        enumerable: true, value: async function (element, data) {
            if (!(element instanceof HTMLElement)) return
            if (data === null) return
            const tag = (element.getAttribute('is') || element.tagName).toLowerCase()
            if (typeof data !== 'object') {
                if (element.constructor.E_ValueProperty) {
                    return element[element.constructor.E_ValueProperty] = data
                } else if (element.constructor.observedAttributes && element.constructor.observedAttributes.includes('value')) {
                    return element.value = data
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
                    return delete element[k]
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
                        switch (v) {
                            case true: case false:
                                element.toggleAttribute(k.slice(1) || 'name', v)
                                continue
                            case null: case undefined:
                                element.removeAttribute(k.slice(1) || 'name')
                                continue
                            default:
                                element.setAttribute(k.slice(1) || 'name', v)
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
                        if (!eventName) eventName = element.constructor.E_DefaultEventType ?? this.E.sys.defaultEventTypes[tag] ?? 'click'
                        v === null ? element.addEventListener(eventName, event => event.preventDefault(), { once: true }) : element.dispatchEvent(new CustomEvent(eventName, { detail: v, bubbles: true, cancelable: true }))
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
                                            if (this.app.templates[renderExpression] && (this.app.templates[renderExpression] instanceof HTMLTemplateElement)) {
                                            } else if (this.env.templates[renderExpression]) {
                                                const envTemplate = this.env.templates[renderExpression]
                                                this.app.templates[renderExpression] = document.createElement('template')
                                                if (envTemplate instanceof HTMLTemplateElement) {
                                                    this.app.templates[renderExpression].innerHTML = envTemplate.innerHTML
                                                } else if (typeof envTemplate === 'string') {
                                                    if (envTemplate[0] === '`' && envTemplate.slice(-1) === '`') {
                                                        this.app.templates[renderExpression].innerHTML = await (await fetch(this.resolveUrl(envTemplate.slice(1, -1)))).text()
                                                    } else {
                                                        this.app.templates[renderExpression].innerHTML = envTemplate
                                                    }
                                                } else if (Array.isArray(envTemplate)) {
                                                    this.app.templates[renderExpression].innerHTML = await (await fetch(this.resolveUrl(...envTemplate))).text()
                                                }
                                            } else {
                                                this.app.templates[renderExpression] = document.createElement('template')
                                                this.app.templates[renderExpression].innerHTML = await (await fetch(this.resolveUrl(renderExpression))).text()
                                            }
                                            useTemplate = this.app.templates[renderExpression]
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
            if (!scopeStatement) return element.parentElement
            let scope, root, prop
            switch (scopeStatement) {
                case '$':
                    return element
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
                    return element.closest(scopeStatement)
            }
        }
    },
    resolveScopedSelector: {
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
    resolveSelector: {
        enumerable: true, value: function (selector, scope) {
            if (!selector) return scope
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
                const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
                return typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath, this) : value
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
            if (transformKey[0] === '`') [transform, expression] = this.app.transforms[transformKey] ??
                (this.env.transforms[transformKey] ? [transformKey, this.env.transforms[transformKey]]
                    : [await fetch(this.resolveUrl(transformKey.slice(1, -1).trim())).then(r => r.text()), undefined])
            if (!transform) return data
            if (!this.app.transforms[transformKey]) {
                expression ||= this.env.transforms[transformKey]
                if (!expression) {
                    await this.loadHelper('application/x-jsonata')
                    expression = this.useHelper('application/x-jsonata', transform)
                }
                this.app.transforms[transformKey] = [transform, expression]
            }
            expression ||= this.app.transforms[transformKey][1]
            const bindings = {}
            if (element && transform.includes('$find(')) bindings.find = qs => qs ? this.flatten(this.resolveScopedSelector(qs, element) ?? {}) : this.flatten(element)
            if (element && transform.includes('$this')) bindings.this = this.flatten(element)
            if (element && transform.includes('$root')) bindings.root = this.flatten(element.getRootNode())
            if (element && transform.includes('$host')) bindings.host = this.flatten(element.getRootNode().host)
            if (element && transform.includes('$document')) bindings.document = { ...this.flatten(document.documentElement), ...this.flatten(document) }
            for (const [k, v] of Object.entries(variableMap)) if (transform.includes(`$${k}`)) bindings[k] = typeof v === 'function' ? v : this.flatten(v)
            const result = await expression.evaluate(data, bindings)
            return result
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

    _styles: { value: {} },
    _templates: { value: {} },
    classes: { value: {} },
    constructors: { value: {} },
    extends: { value: {} },
    files: { value: {} },
    ids: { value: {} },
    scripts: { value: {} },
    styles: { value: {} },
    tags: { value: {} },
    templates: { value: {} },

    activateTag: {
        value: async function (tag, forceReload = false) {
            if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
            const id = this.getTagId(tag);
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
                this.tags[id] = Array.from(this.tags[id])
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
    getCustomTag: {
        value: function (element) {
            return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
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
        enumerable: true, value: function (expression, value, labels, env) {
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
                case '%':
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
    sliceAndStep: {
        value: function (sig, list) {
            let [start = 0, end = list.length, step = 0] = sig.split(':').map(s => (parseInt(s) || 0))
            if (end === 0) end = list.length
            list = list.slice(start, end)
            if (!step) return list
            return (step === 1) ? list.filter((v, i) => (i + 1) % 2) : list.filter((v, i) => (i + 1) % step === 0)
        }
    },
    sortByInheritance: {
        value: function (idList) {
            return Array.from(new Set(idList)).filter(t => this.extends[t]).sort((a, b) =>
                ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
                .map((v, i, a) => (i === a.length - 1) ? [v, this.extends[v]] : v).flat()
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

    _base: {
        value: function (baseClass = globalThis.HTMLElement) {
            return class extends baseClass {
                constructor() {
                    super()
                    Object.defineProperty(this, 'E', { value: ElementHTML })
                    Object.defineProperty(this, 'E_emitValueChange', {
                        value: function (value, eventName, bubbles = true, cancelable = true, composed = false) {
                            if (!eventName) eventName = this.constructor.E_DefaultEventType ?? this.E.sys.defaultEventTypes[this.tagName.toLowerCase()] ?? 'click'
                            this.dispatchEvent(new CustomEvent(eventName, { detail: value, bubbles, cancelable, composed }))
                        }
                    })
                    try {
                        this.shadowRoot || this.attachShadow({ mode: this.constructor.E_ShadowMode ?? 'open' })
                        this.shadowRoot.textContent = ''
                        this.shadowRoot.appendChild(document.createElement('style')).textContent = ElementHTML._styles[this.constructor.id] ?? ElementHTML.stackStyles(this.constructor.id)
                        const templateNode = document.createElement('template')
                        templateNode.innerHTML = ElementHTML._templates[this.constructor.id] ?? ElementHTML.stackTemplates(this.constructor.id)
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
    }

})
const metaUrl = new URL(import.meta.url), metaOptions = metaUrl.searchParams
if (metaOptions.has('packages')) {
    const importmapElement = document.head.querySelector('script[type="importmap"]')
    let importmap = { imports: {} }
    if (importmapElement) try { importmap = JSON.parse(importmapElement.textContent.trim()) } catch (e) { }
    const imports = importmap.imports ?? {}, importPromises = {}, importKeys = {}
    for (const p of metaOptions.get('packages').split(',').map(s => s.trim())) if (p && (typeof imports[p] === 'string') && imports[p].includes('/')) {
        if (imports[p].endsWith('/')) imports[p] = `${imports[p]}package.js`
        const importUrl = ElementHTML.resolveUrl(imports[p])
        importPromises[importUrl] = import(importUrl)
        importKeys[importUrl] = p
    }
    await Promise.all(Object.values(importPromises))
    for (const url in importPromises) await ElementHTML.ImportPackage(await importPromises[url], url, importKeys[url])
}
if (metaOptions.has('expose')) ElementHTML.Expose(metaOptions.get('expose'))
if (metaOptions.has('load')) await ElementHTML.load()
export { ElementHTML }