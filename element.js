const ElementHTML = Object.defineProperties({}, {
    version: {enumerable: true, value: '0.8.0'},
    env: {enumerable: true, value: Object.defineProperties({}, {
        auth: {enumerable: true, value: {}},
        eDataset: {enumerable: true, value: new EventTarget()},
        globalLoadCalled: {configurable: true, enumerable: true, writable: true, value: false},
        globalThis: {enumerable: true, value: globalThis},
        modes: {configurable: true, enumerable: true, writable: true, value: {
            element: 'element.html', layout: 'default.html', content: 'home.html', meta: 'home.html',
            theme: 'default.css', data: 'main.json', media: 'image.webp', processor: 'module.js', 
            schema: 'Thing', context: 'context.json'
        }},
        routerTags: {enumerable: true, value: ['e-router', 'e-repository']},
        gateways: {enumerable: true, value: {
            ipfs: hostpath => `https://${this.splitOnce(hostpath, '/').join('.ipfs.dweb.link/')}`, 
            ipns: hostpath => `https://${this.splitOnce(hostpath, '/').join('.ipns.dweb.link/')}`
        }},
        options: {enumerable: true, value: {}}
    })},
    ids: {enumerable: true, value: {}},
    tags: {enumerable: true, value: {}},
    extends: {enumerable: true, value: {}},
    files: {enumerable: true, value: {}},
    styles: {enumerable: true, value: {}},
    templates: {enumerable: true, value: {}},
    scripts: {enumerable: true, value: {}},
    classes: {enumerable: true, value: {}},
    constructors: {enumerable: true, value: {}},
    load: {enumerable: true, value: async function(rootElement=undefined) {
        if (!rootElement && this.env.globalLoadCalled) return
        rootElement || (Object.defineProperty(this.env, 'globalLoadCalled', {configurable: false, enumerable: true, writable: false, value: true})
            && this._enscapulateNative())
        rootElement && await this.activateTag(this.getCustomTag(rootElement), rootElement)
        if (rootElement && !rootElement.shadowRoot) return
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) if (this.getCustomTag(element)) await this.load(element)
        const parseHeadMeta = (addedNode) => {
            const addedNodeMatches = addedNode.matches('title') ? 'title' : (addedNode.matches('meta[content][name]') ? 'meta' : false)
            let property, value
            if (addedNodeMatches==='title') [property, value] = ['title', addedNode.textContent]
            if (addedNodeMatches==='meta') [property, value] = [addedNode.getAttribute('name'), addedNode.getAttribute('content')]
            if (addedNodeMatches) {
                let oldValue = this.env.eDataset[property]
                this.env.eDataset[property] = value
                this._dispatchPropertyEvent(this.env.eDataset, 'change', property, {
                    property: property, value: value, oldValue: oldValue, sanitizedValue: value, 
                    validatedValue: value, sanitizerDetails: undefined, validatorDetails: undefined
                })
            }
        }
        observerRoot._observer ||= new MutationObserver(async records => {
            for (const record of records) for (const addedNode of (record.addedNodes||[])) {
                if (this.getCustomTag(addedNode)) await this.load(addedNode)
                if (addedNode.parentElement === document.head) parseHeadMeta(addedNode)
            } 
        })
        observerRoot._observer.observe(domRoot, {subtree: true, childList: true})
        if (!rootElement) for (const metaElement of document.head.children) parseHeadMeta(metaElement)
    }},
    getCustomTag: {enumerable: true, value: function(element) {
        return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
    }},
    getURL: {enumerable: true, value: function(value) {
        if (value.startsWith('https://') || !value.includes('://')) return value
        const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
        return typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath) : value
    }},
    isURL: {enumerable: true, value: function(value) { return value && value.includes('/') }},
    splitOnce: {enumerable: true, value: function(str, delimiter) { 
        let r
        str.split(delimiter).some((e,i,a) => r = a.length<=2?(a):[a[0], a.slice(1).join(delimiter)])
        return r
    }},
    resolveMeta: {enumerable: true, value: function(element, is,  name, namespace, exact=false) {
        let metaElement
        const rootNode = element.shadowRoot || element.getRootNode()
        if (rootNode instanceof ShadowRoot) {
            for (const m of rootNode.querySelectorAll('meta')) if (((!name || m.name === name) && (!is || (is === m.getAttribute('is'))))) if (metaElement = m) break
            return metaElement || this.resolveMeta(rootNode.host.getRootNode(), is, name, namespace, exact)
        } else {
            for (const m of document.head.getElementsByTagName('meta')) if ((!name || m.name === name) && (!is || (is === m.getAttribute('is')))) if (namespace && m.namespace) {
                    if ((exact && namespace.split(' ').includes(m.namespace)) || (!exact && namespace.split(' ').some(s => s.startsWith(m.namespace)))) {
                        metaElement = m
                        break
                    }
                } else {
                    metaElement = m
                    break
                }
            return metaElement
        }
    }},
    resolveProcessor: {enumerable: true, value: function(element, name) {
        if (!name) return
        let processor = this.resolveMeta(element, 'e-processor', name) 
            || this.resolveMeta(element, 'e-proce', undefined, name, true) || this.resolveMeta(element, 'e-proce', undefined, name, false)
        return processor        
    }},
    resolveRouter: {enumerable: true, value: function(element, name) {
        if (!name) return
        let router = this.resolveMeta(element, this.env.routerTags[0], name)
        if (!router) for(const routerTag of this.env.routerTags.slice(1)) router ||= this.resolveMeta(element, routerTag, name)
        return router        
    }},
    activateTag: {enumerable: true, value: async function(tag, element, forceReload=false) {
        if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
        const id = await this.getTagId(tag, element);
        [this.ids[tag], this.tags[id]] = [id, tag]
        await this.loadTagAssetsFromId(id, forceReload)
        const baseTag = this.getInheritance(id).pop() || 'HTMLElement'
        globalThis.customElements.define(tag, this.constructors[id], (baseTag && baseTag !== 'HTMLElement' & !baseTag.includes('-')) ? {extends: baseTag} : undefined)
    }},
    getTagId: {enumerable: true, value: async function(tag, element) {
        if (this.ids[tag]) return this.ids[tag]
        const [tagRouterName, tagComponent] = tag.split('-', 2).map(t => t.toLowerCase())
        let tagRouter = this.resolveRouter(element, tagRouterName)
        return await tagRouter?.element(tagComponent) || (new URL(`./${(tagRouterName)}/element/${tagComponent}.html`,
            tagRouterName === 'e' ? import.meta.url : element.baseURI)).href
    }},
    loadTagAssetsFromId: {enumerable: true, value: async function(id, forceReload=false) {
        if (!id.includes('://') || (!forceReload && this.files[id])) return
        this.files[id] = await fetch(this.getURL(id)).then(r => r.text())
        this.styles[id] = this.files[id].slice(this.files[id].indexOf('<style>')+7, this.files[id].indexOf('</style>')).trim()
        this.templates[id] = this.files[id].slice(this.files[id].indexOf('<template>')+10, this.files[id].indexOf('</template>')).trim()
        this.scripts[id] = this.files[id].slice(this.files[id].indexOf('<script>')+8, this.files[id].indexOf('</script>')).trim()
        const extendsRegExp = /class\s+extends\s+`(?<extends>.*)`\s+\{/, ElementHTML = this
        let extendsId = this.scripts[id].match(extendsRegExp)?.groups?.extends || 'HTMLElement'
        if (extendsId) {
            if (extendsId.includes('/')) {
                if (!extendsId.startsWith('https://') && !extendsId.startsWith('https://')) extendsId = new URL(extendsId, id).href
                if (!extendsId.endsWith('.html')) extendsId += '.html'
            }
            this.extends[id] = extendsId
            this.files[extendsId] || !extendsId.includes('/') || await this.loadTagAssetsFromId(extendsId)
        }
        let sanitizedScript = this.scripts[id].replace(extendsRegExp, `class extends ElementHTML.constructors['${extendsId}'] {`)
        this.classes[id] = Function('ElementHTML', 'return ' + sanitizedScript)(this)
        this.classes[id].id = id
        this.constructors[id] = class extends this.classes[id] {constructor() {super()}}
    }},
    getInheritance: {enumerable: true, value: function(id='HTMLElement') {
        const inheritance = [id]
        while (id && this.extends[id]) inheritance.push(id = this.extends[id])
        return inheritance
    }},
    sortByInheritance: {configurable: false, enumerable: true, writable: false, value: function(idList) {
        return Array.from(new Set(idList)).filter(t => this.extends[t]).sort((a, b) => 
            ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
            .map((v, i, a) => (i === a.length-1) ? [v, this.extends[v]] : v).flat()
    }},
    getObserved: {enumerable: true, value: function(element, scope, observe) {
        const scopesMap = {document: document, 'document.head': document.head, 'document.body': document.body,
        body: document.body, head: document.head, root: element.getRootNode(), parent: element.parentElement}
        let useScope = scope && scopesMap[scope] ? scopesMap[scope] : undefined
        if (!useScope && scope && scope.startsWith('closest(') && scope.endWith(')')) useScope = element.closest(scope.slice(8, -1))
        useScope ||= element.parentElement
        useScope ||= element.getRootNode()
        return useScope.querySelector(observe) || useScope
    }},
    createObserver: {enumerable: true, value: function(element, observed, takeRecordsCallback, observerCallback) {
        if (element._observer) takeRecordsCallback(element._observer.takeRecords())
        element._observer && (element._observer.disconnect() || (delete element._observer))
        element._observer = new MutationObserver(observerCallback)
        element._observer.observe(observed, {subtree: true, childList: true, attributes: true, attributeOldValue: true})
    }},
    applyHash: {enumerable: true, value: function(hash, data) {
        if (hash && (Array.isArray(data) || (data instanceof HTMLCollection))) {
            const result = []
            for (const hashFrag of hash.split(';').map(s => s.trim())) if (hashFrag.includes(':')) {
                    data = Array.from(data)
                    result.push(data.slice(...hashFrag.split(/:(.+)/).map((s, i) => parseInt(s.trim())||(i===0?0:data.length))))
                } else {
                    result.push(data[hashFrag])
                }
            return result
        } else { return (data instanceof HTMLCollection) ? Array.from(data) : data }
    }},
    applyField: {enumerable: true, value: function(field, data) {
        if (!field) return data
        const fieldedData = data, resultArray = [], fieldFrags = field.split(',').map(s => s.trim())
        for (const fieldFrag of fieldFrags) {
            let [fieldFragName, fieldFragVector] = fieldFrag.split(':', 2).map(s => s.trim()), thisData = data
            fieldFragVector ?? ([fieldFragVector, fieldFragName] = [fieldFragName, fieldFragVector])
            for (const vector of (fieldFragVector).split('.').map(s => s.trim())) {
                thisData = thisData[vector]
                if (!(thisData instanceof Object)) break
            }
            resultArray.push(fieldFragName ? ({[fieldFragName]: thisData }) : thisData)
        }
        return resultArray.length === 1 ? resultArray[0] : (resultArray.every(v => v instanceof Object) ? Object.assign({}, ...resultArray) : resultArray)
    }},
    getValue: {enumerable: true, value: function(element) {
        if (element.hasAttribute('itemscope')) {
            const value = {}, parseElementForValues = (el) => {
                if (!el) return
                const scopeTo = el.hasAttribute('id') ? 'id': 'itemscope'
                for (const propElement of el.querySelectorAll('[itemprop]')) if (propElement.parentElement.closest(`[${scopeTo}]`) === el ) {
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
            const valueproxy = element.getAttribute('valueproxy')
            if (valueproxy) return element.eDataset[valueproxy]
            return Object.assign({}, element.dataset)
        } else {
            return element[(element.value??((element.src??'textContent')||'src'))||'value']
        }
    }},
    setValue: {enumerable: true, value: function(element, value) {
        if (value instanceof Object) {
            if (element.hasAttribute('itemscope')) {
                for (const [propName, propValue] of Object.entries(value)) {
                    let propElement
                    if (element.hasAttribute('itemref')) {
                        const rootNode = element.getRootNode()
                        for (const ref of element.getAttribute('itemref').split(' ')) {
                            propElement ||= rootNode.getElementById(ref)?.querySelector(`[itemprop="${propName}"]`)
                            if (propElement) break
                        }
                    } else { propElement = element.querySelector(`[itemprop="${propName}"]`) }
                    if (propElement) this.setValue(propElement, propValue)
                }
            } else { 
                Object.assign((element.eDataset || element.dataset), value)
            }
        } else {
            let valueproxy
            if (element.eDataset instanceof Object && (valueproxy = element.getAttribute('valueproxy'))) {
                element.eDataset[valueproxy] = value
            } else { element[(element.value??((element.src??'textContent')||'src'))||'value'] = value }
        }
    }},
    sinkData: {enumerable: true, value: function(element, data, sinkFlag, pointerElement) {
        sinkFlag ||= pointerElement?.sink
        if (element === document.head || element === document || (element === pointerElement && pointerElement?.parentElement === document.head)) {
            const useNode = element === document.head ? element : document
            for (const [k, v] of Object.entries(data)) {
                if (k==='title' || k==='@title' || k==='.title') {
                    useNode.querySelector('title').textContent = v
                } else {
                    const metaElements = useNode.children,
                        metaElement = (k.startsWith('@') || k.startsWith('.')) ? metaElements[k.slice(1)] : metaElements[k]
                    metaElement && metaElement.setAttribute('content', v)
                }
            }
            return
        }
        const tag = element.tagName.toLowerCase()
        if (sinkFlag === '@') {
            for (const [k, v] of Object.entries(data)) element.setAttribute(k, v)
        } else if (sinkFlag === '.') {
            for (const [k, v] of Object.entries(data)) element[k] = v
        } else if (sinkFlag === 'dataset') {
            for (const [k, v] of Object.entries(data)) element.dataset[k] = v
        } else if (sinkFlag === 'eDataset' && element.eDataset instanceof Object) {
            Object.assign(element.eDataset, data)
        } else if (sinkFlag.startsWith('auto')) {
            if (element.eDataset instanceof Object) {
                Object.assign(element.eDataset, data)
            } else {
                for (const [k, v] of Object.entries(data)) {
                    if (v.startsWith('@')) element.setAttribute(k.slice(1), v)
                    if (v.startsWith('.')) element[k.slice(1)] = v
                    if (sinkFlag === 'auto-data') element.dataset[k] = v
                }
            }
        } else if (sinkFlag && ((sinkFlag.startsWith('...')) || (typeof element[sinkFlag] === 'function'))) {
            if (sinkFlag.startsWith('...')) {
                const sinkFunctionName = sinkFlag.slice(3)
                if (typeof element[sinkFunctionName] === 'function') {
                    element[sinkFunctionName](...data)
                } else if (element[sinkFunctionName] instanceof Object) {
                    element[sinkFunctionName] = {...element[sinkFunctionName], ...data}
                }
            } else { element[sinkFlag](data) }
        } else if (sinkFlag && element[sinkFlag] instanceof Object) {
            Object.assign(element[sinkFlag], data)
        } else if (['input', 'select', 'datalist'].includes(tag)) {
            const optionElements = []
            for (const k in data) {
                const optionElement = document.createElement('option')
                optionElement.value = Array.isArray(data) ? data[k] : k
                optionElement.setAttribute(optionElement.value)
                optionElement.textContent = data[k]
                optionElements.push(optionElement)
            }
            if (tag === 'select' || tag === 'datalist') {
                element.replaceChildren(...optionElements)
            } else if (tag === 'input' && pointerElement) {
                const datalist = document.createElement('datalist')
                datalist.replaceChildren(...optionElements)
                pointerElement.dataset.datalistId = crypto.randomUUID()
                datalist.setAttribute('id', pointerElement.dataset.datalistId)
                document.body.append(datalist)
                element.setAttribute('list', pointerElement.dataset.datalistId)
            }
        } else if (['form', 'fieldset'].includes(tag)) {
            for (const [k, v] of Object.entries(data)) (element.querySelector(`[name="${k}"]`)||{}).value = v
        } else if (['table', 'tbody'].includes(tag)) {
            let tbody = tag === 'tbody' ? element : element.querySelector('tbody')
            if (!tbody) element.append(tbody = document.createElement('tbody'))
            let rowsData = ((Array.isArray(data) && data.every(r => Array.isArray(r)))
                || (data instanceof Object && Object.values(data).every(r => Array.isArray(r)))) ? data : undefined
            if (rowsData) {
                if (tag === 'table') {
                    const headers = rowsData.shift()
                    let thead = element.querySelector('thead')
                    if (!thead) element.prepend(thead = document.createElement('thead'))
                    let thRow = thead.querySelector('tr')
                    if (!thRow) thead.prepend(thRow = document.createElement('tr'))
                    for (const h of headers) thead.appendChild(document.createElement('th')),textContent = h
                }
                const namedRows = data instanceof Object
                for (const [k, v] of Object.entries(rowsData)) {
                    const tr = document.createElement('tr')
                    namedRows && tr.setAttribute('name', k)
                    for (const vv of v) tr.appendChild(document.createElement('td')).textContent = vv
                    tbody.append(tr)
                }
            }
        } else if (element.hasAttribute('itemscope') && data instanceof Object) {
            for (const [k, v] of data) {
                if (Array.isArray(v)) {
                    for (const [i, nn] of Array.from(element.querySelectorAll(`[itemprop="${k}"]`))) nn.textContent = v[i] ?? ''
                } else { (element.querySelector(`[itemprop="${k}"]`)||{}).textContent = v }
            }
        } else {
            Object.assign(element.eDataset instanceof Object ? element.eDataset : element.dataset, data)
        }
    }},
    stackTemplates: {enumerable: true, value: function(id, templateInnerHTML=undefined) {
        const template = document.createElement('template')
        template.innerHTML = templateInnerHTML || this.templates[id]
        for (const t of template.content.querySelectorAll('template[id]')) {
            const tId = t.getAttribute('id'), tNode = document.createElement('template')
            tNode.innerHTML = this.stackTemplates(tId)
            const clonedNode = tNode.content.cloneNode(true)
            if (t.hasAttribute('slot')) {
                const tSlot = t.getAttribute('slot'), targetSlot = clonedNode.querySelector(`slot[name="${tSlot}"]`)
                    || clonedNode.querySelector(tSlot || 'slot') || clonedNode.querySelector('slot')
                targetSlot && targetSlot.replaceWith(this.stackTemplates(undefined, t.innerHTML))
            }
            t.replaceWith(clonedNode)
        }
        return template.innerHTML
    }},
    stackStyles: {enumerable: true, value: function(id) {
        return this.getInheritance(id).reverse().filter(t => t.includes('-')).map(t => `/** ${t} styles */\n\n` + this.styles[t]).join("\n\n\n")
    }},
    _observer: {writable: true, value: undefined},
    _enscapulateNative: {value: function() {
        const HTMLElements = ['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em',
            'figcaption', 'figure', 'footer', 'header', 'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby',
            's', 'samp', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr']
        for (const tag of HTMLElements) this.ids[tag] = 'HTMLElement'
        Object.assign(this.ids, {
            a: 'HTMLAnchorElement', blockquote: 'HTMLQuoteElement', br: 'HTMLBRElement', caption: 'HTMLTableCaptionElement',
            col: 'HTMLTableColElement', colgroup: 'HTMLTableColElement', datalist: 'HTMLDataListElement', del: 'HTMLModElement', dl: 'HTMLDListElement',
            fieldset: 'HTMLFieldSetElement', h1: 'HTMLHeadingElement', h2: 'HTMLHeadingElement', h3: 'HTMLHeadingElement', h4: 'HTMLHeadingElement',
            h5: 'HTMLHeadingElement', h6: 'HTMLHeadingElement', hr: 'HTMLHRElement', iframe: 'HTMLIFrameElement', img: 'HTMLImageElement',
            ins: 'HTMLModElement', li: 'HTMLLIElement', ol: 'HTMLOListElement', optgroup: 'HTMLOptGroupElement', p: 'HTMLParagraphElement', q: 'HTMLQuoteElement',
            tbody: 'HTMLTableSectionElement', td: 'HTMLTableCellElement', textarea: 'HTMLTextAreaElement', tfoot: 'HTMLTableSectionElement',
            th: 'HTMLTableCellElement', th: 'HTMLTableSectionElement', tr: 'HTMLTableRowElement', ul: 'HTMLUListElement'
        })
        for (const tag in this.ids) {
            if (tag.includes('-')) continue
            const id = this.ids[tag]
            if (this.tags[id]) {
                if (!Array.isArray(this.tags[id])) this.tags[id] = Array.of(this.tags[id])
                this.tags[id].push(tag)
            } else { this.tags[id] = tag }
        }
        const classNames = Object.values(this.ids)
        for (const nc of Reflect.ownKeys(globalThis)) if (nc.startsWith('HTML') && nc.endsWith('Element')) this.ids[nc.replace('HTML', '').replace('Element', '').toLowerCase()] ||= nc
        delete this.ids.image
        this.ids[''] = 'HTMLElement'
        this.ids['HTMLElement'] = 'HTMLElement'
        for (const id in this.ids) {
            this.classes[id] = globalThis[this.ids[id]]
            this.constructors[id] = this._base(this.classes[id])
        } 
    }},
    _dispatchPropertyEvent: {value: function(element, eventNamePrefix, property, eventDetail) {
        eventDetail = {detail: {property: property, ...eventDetail}}
        element.dispatchEvent(new CustomEvent(eventNamePrefix, eventDetail))
        element.dispatchEvent(new CustomEvent(`${eventNamePrefix}-${property}`, eventDetail))
    }},
    _base: {value: function(baseClass=globalThis.HTMLElement) {
        return class extends baseClass {
            #valueproxy
            constructor() {
                super()
                const $this = this, addSrcToDocument = (querySelectorTemplate, src, tagName, srcAttrName, appendTo, otherAttrs=[]) => {
                    if (document.querySelector(querySelectorTemplate.replace(/\$E/g, src))) return
                    const tag = appendTo.appendChild(document.createElement(tagName))
                    tag.setAttribute(srcAttrName, src)
                    for (const a of otherAttrs) tag.setAttribute(...a)
                }
                for (const src of ($this.constructor.eJs || [])) addSrcToDocument('script[src="$E"]', src, 'script', 'src', document.body)
                for (const src of ($this.constructor.eMjs || [])) addSrcToDocument('script[src="$E"]', src, 'script', 'src', document.body, [['type', 'module']])
                for (const src of ($this.constructor.eCss || [])) addSrcToDocument('link[rel="stylesheet"][href="$E"]', src, 'link', 'href', document.head, [['rel', 'stylesheet']])
                $this.constructor.eWasmModules ||= {}
                for (const moduleName in ($this.constructor.eWasm||{})) {
                    if ($this.constructor.eWasmModules[moduleName]) continue
                    $this.constructor.eWasmModules[moduleName] = true
                    WebAssembly.instantiateStreaming(fetch(ElementHTML.getURL($this.constructor.eWasm[moduleName].src)),
                        $this.constructor.eWasm[moduleName].importObject).then(importResult => 
                            $this.constructor.eWasmModules[moduleName] = importResult
                    ).catch(e => $this.constructor.eWasmModules[moduleName] = {})
                }
                Object.defineProperties($this, {
                    e: {enumerable: true, value: ElementHTML},
                    eProcessors: {enumerable: true, value: new Proxy({}, {
                        get(target, property, receiver) { return (ElementHTML.resolveMeta($this, property, 'e-processor') || {}).func }
                    })},
                    eContext: {enumerable: true, writable: true, value: {}},
                    eSchema: {enumerable: true, writable: true, value: {
                        has: (e, p) => p in e.dataset, get: (e, p) => e.dataset[p], sanitize: (e, p,v) => [v], validate: (e, p,v) => [v],
                        set: (e, p,v) => e.dataset[p] = v, deleteProperty: (e, p) => delete e.dataset[p]
                    }},
                    eDataset: {enumerable: true, value: new Proxy($this.dataset, {
                        has(target, property) {
                            switch(property[0]) {
                            case '@':
                                return $this.hasAttribute(property.slice(1))
                            case '.':
                                return property.slice(1) in $this
                            case '#':
                                return $this.eSchema.has($this, property.slice(1))
                            default:
                                return property in target || $this.eSchema.has($this, property)
                            }
                        },
                        get(target, property, receiver) {
                            switch(property[0]) {
                            case '@':
                                return $this.getAttribute(property.slice(1))
                            case '.':
                                return $this[property.slice(1)]
                            case '#': 
                                return $this.eSchema.get($this, property.slice(1))
                            default:
                                return target[property] ?? $this.eSchema.get($this, property)
                            }
                        },
                        set(target, property, value, receiver) {
                            switch(property[0]) {
                            case '@':
                                return $this.setAttribute(property.slice(1), value)
                            case '.':
                                return $this[property.slice(1)] = value
                            case '#':
                                return $this.eSchema.set($this, property.slice(1), value)
                            default:
                                let sanitizedValue, sanitizerDetails, validatedValue, validatorDetails;
                                [sanitizedValue, sanitizerDetails] = $this.eSchema.sanitize($this, property, value)
                                if (sanitizedValue !== value) ElementHTML._dispatchPropertyEvent($this, 'sanitized', property, {
                                            property: property, givenValue: value, sanitizedValue: sanitizedValue, sanitizerDetails: sanitizerDetails
                                        })
                                value = sanitizedValue;
                                const oldValue = target[property]
                                if (oldValue !== value) {
                                    $this.eSchema.set($this, property, value);
                                    [validatedValue, validatorDetails] = $this.eSchema.validate($this, property, value)
                                    if (validatedValue !== value) ElementHTML._dispatchPropertyEvent($this, 'validated', property, {
                                                property: property, givenValue: value, validatedValue: validatedValue, validatorDetails: validatorDetails
                                            })
                                    ElementHTML._dispatchPropertyEvent($this, 'change', property, {
                                        property: property, value: value, oldValue: oldValue, sanitizedValue: sanitizedValue, 
                                        validatedValue: validatedValue, sanitizerDetails: sanitizerDetails, validatorDetails: validatorDetails
                                    })
                                }
                                return value
                            }
                        },
                        deleteProperty(target, property) {
                            switch(property[0]) {
                            case '@':
                                return $this.removeAttribute(property.slice(1))
                            case '.':
                                return delete $this[property.slice(1)]
                            case '#':
                                return $this.eSchema.deleteProperty($this, property.slice(1))
                            default:
                                const oldValue = target[property]
                                const retval = $this.eSchema.deleteProperty($this, property)
                                let [validatedValue, validatorDetails] = $this.eSchema.validate($this, property, undefined)
                                if (validatedValue !== undefined) ElementHTML._dispatchPropertyEvent($this, 'validated', property, {
                                            property: property, givenValue: undefined, validatedValue: validatedValue, validatorDetails: validatorDetails
                                        })
                                ElementHTML._dispatchPropertyEvent($this, 'deleteProperty', property, {
                                    property: property, value: undefined, oldValue: oldValue, validatedValue: validatedValue, validatorDetails: validatorDetails
                                })
                                return retval
                            }
                        }
                    })},
                    eQueuedAttributes: {enumerable: true, value: {}}
                })
                try {
                    $this.shadowRoot || $this.attachShadow({mode: 'open'})
                    $this.shadowRoot.textContent = ''
                    $this.shadowRoot.appendChild(document.createElement('style')).textContent = ElementHTML.stackStyles(this.constructor.id)
                    const templateNode = document.createElement('template')
                    templateNode.innerHTML = ElementHTML.stackTemplates(this.constructor.id)
                    $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
                    Object.defineProperty($this, 'eMeta', {enumerable: true, 
                        get: () => Object.fromEntries(Array.from($this.shadowRoot.children).filter(n => n.matches('meta')).map((n,i) => [[n.name, n], [i, n]]).flat())
                    })
                } catch(e) {}
            }
            static get observedAttributes() { 
                return ['valueproxy'] 
            }
            static e = ElementHTML
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            eProcessQueuedAttributes() {
                const $this = this
                for (const k in $this.eQueuedAttributes) {
                    if (typeof $this.eQueuedAttributes[k]?.requires === 'function' && $this.eQueuedAttributes[k].requires() === false) continue
                    if ($this.eQueuedAttributes[k].attribute && $this.eQueuedAttributes[k].value) {
                        $this.setAttribute($this.eQueuedAttributes[k].attribute, $this.eQueuedAttributes[k].value)
                        typeof $this.eQueuedAttributes[k].callback === 'function' && $this.eQueuedAttributes[k].callback()
                    }
                    delete $this.eQueuedAttributes[k]
                }
                if (Object.keys($this.eQueuedAttributes).length === 0) globalThis.clearInterval($this.eQueuedAttributeInterval)
            }
            eAddQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.eQueuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.eQueuedAttributeInterval ||= globalThis.setInterval(() => $this.eProcessQueuedAttributes(), 1000)
            }
            valueOf() { return this.e.getValue(this) }
            set valueproxy(value) { this.#valueproxy = value }
            get valueproxy() { return this.#valueproxy }
        }
    }}
})
Object.defineProperty(ElementHTML.env, 'ElementHTML', {enumerable: true, value: ElementHTML})
const newModes = {}
for (const mode in ElementHTML.env.modes) {
    const [d, s] = ElementHTML.env.modes[mode].split('.')
    Object.defineProperty(newModes, mode, {enumerable: true, value: Object.defineProperties({}, {
            default: {enumerable: true, value: d}, suffix: {enumerable: true, value: s}
        })
    })
}
Object.defineProperty(ElementHTML.env, 'modes', {enumerable: true, value: newModes})
await ElementHTML.load()
export { ElementHTML }