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
            schema: 'Thing', context: 'root.json'
        }},
        routerTags: {enumerable: true, value: ['e-router', 'e-repository']},
        proxies: {enumerable: true, value: {}},
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
            if (!addedNodeMatches) return
            let oldValue = this.env.eDataset[property]
            this.env.eDataset[property] = value
            this._dispatchPropertyEvent(this.env.eDataset, 'change', property, {
                property: property, value: value, oldValue: oldValue, sanitizedValue: value,
                validatedValue: value, sanitizerDetails: undefined, validatorDetails: undefined
            })
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
        value = typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath) : value
        for (const [k, v] of Object.entries(this.env.proxies)) if (value.startsWith(k)) value = value.replace(k, v)
        return value
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
        if (!name || !element) return
        let processor = this.resolveMeta(element, 'e-processor', name)
            || this.resolveMeta(element, 'e-proce', undefined, name, true) || this.resolveMeta(element, 'e-proce', undefined, name, false)
        return processor
    }},
    resolveRouter: {enumerable: true, value: function(element, name) {
        if (!name || !element) return
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
        if (!hash) return data
        if (data instanceof HTMLCollection) data = Array.from(data)
        if (!Array.isArray(data)) return data
        const result = []
        for (const hashFrag of hash.split(';').map(s => s.trim())) if (hashFrag.includes(':')) {
                data = Array.from(data)
                result.push(data.slice(...hashFrag.split(/:(.+)/).map((s, i) => parseInt(s.trim())||(i===0?0:data.length))))
            } else { result.push(data[hashFrag]) }
        return result
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
        if (!element) return
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
            const tag = element.tagName.toLowerCase()
            if (tag === 'meta') return element.getAttribute('content')
            if (['audio','embed','iframe','img','source','track','video'].includes(tag)) return new URL(element.getAttribute('src'), element.getRootNode().baseURI).href
            if (['a','area','link'].includes(tag)) return new URL(element.getAttribute('href'), element.getRootNode().baseURI).href
            if (tag === 'object') return new URL(element.getAttribute('data'), element.getRootNode().baseURI).href
            if (['data','meter','input','select','textarea'].includes(tag)) return element.getAttribute('value')
            if (tag === 'time') return element.getAttribute('datetime')
            return element.textContent
        }
    }},
    setValue: {enumerable: true, value: function(element, value, scopeNode) {
        if (!element) return
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
                    propSiblings[propSiblings.length-1].after(newSibling)
                    this.setValue(newSibling, v)
                    propTemplateDisplay ? newSibling.style.setProperty('display', propTemplateDisplay) : newSibling.style.removeProperty('display')
                    propSiblings[i] = newSibling
                }
                for (const propSibling of propSiblings.slice(value.length)) propSibling.remove()
            } else { Object.assign((element.eDataset || element.dataset), value) }
            return
        }
        let valueproxy
        if (element.eDataset instanceof Object && (valueproxy = element.getAttribute('valueproxy'))) {
            element.eDataset[valueproxy] = value
            if (value === undefined) delete element.eDataset[valueproxy]
            return
        }
        const tag = element.tagName.toLowerCase(), attrMethod = value === undefined ? 'removeAttribute': 'setAttribute'
        if (tag === 'meta') return element[attrMethod]('content', value)
        if (['audio','embed','iframe','img','source','track','video'].includes(tag)) return element[attrMethod]('src', value)
        if (['a','area','link'].includes(tag)) return element[attrMethod]('href', value)
        if (tag === 'object') return element[attrMethod]('data', value)
        if (['data','meter','input','select','textarea'].includes(tag)) return (element.value = (value ??'')) || element[attrMethod]('value', value)
        if (tag === 'time') return element[attrMethod]('datetime', value)
        element.textContent = value
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
                    eRender: {writable: true, enumerable: true, value: (operation, property, value) => {
                        let itemRelIds = [], has = false, elementList = []
                        for (const itemrel of $this.shadowRoot.querySelectorAll('itemrel')) itemRelIds.push(...itemrel.getAttribute('itemrel').split(' '))
                        propget: for (const propElement of $this.shadowRoot.querySelectorAll(`[itemprop="${property}"]`)) {
                            if (propElement.closest('[itemscope]')) continue
                            for (const relid of itemRelIds) if (propElement.closest(`[id="${relid}"]`)) continue propget
                            if (operation === 'has') return true
                            if (operation === 'set') {
                                elementList.push(propElement)
                                continue
                            }
                            const propValue = ElementHTML.getValue(propElement)
                            if (value === undefined) {
                                value = propValue
                                continue
                            }
                            if (!Array.isArray(value)) value = [value]
                            value.push(propValue)
                        }
                        if (operation === 'has') return false
                        if (operation === 'get') return value
                        for (const propElement of elementList) ElementHTML.setValue(propElement, value, $this.shadowRoot)
                    }},
                    eProcessors: {enumerable: true, value: new Proxy({}, {
                        get(target, property, receiver) { return (ElementHTML.resolveMeta($this, property, 'e-processor') || {}).func }
                    })},
                    eContext: {enumerable: true, writable: true, value: {}},
                    eSchema: {enumerable: true, writable: true, value: Object.defineProperties({}, {
                        map: {get: () => Object.fromEntries(Object.keys($this.dataset).map(k => [k, undefined]))},
                        sanitize: {value : (e, p,v) => [v]}, validate: {value: (e, p,v) => [v]}
                    })},
                    eDataset: {enumerable: true, value: new Proxy($this.dataset, {
                        has(target, property) {
                            switch(property[0]) {
                            case '@':
                                return $this.hasAttribute(property.slice(1))
                            case '.':
                                return property.slice(1) in $this
                            case '#':
                                return property.slice(1) in $this.eSchema.map
                            default:
                                return (property in target) || $this.eRender('has', property)
                            }
                        },
                        get(target, property, receiver) {
                            switch(property[0]) {
                            case '@':
                                return $this.getAttribute(property.slice(1))
                            case '.':
                                return $this[property.slice(1)]
                            case '#':
                                return $this.eSchema.map[property.slice(1)]
                            default:
                                if (target[property] !== undefined) return target[property]
                                return $this.eRender('get', property)
                            }
                        },
                        set(target, property, value, receiver) {
                            const oldValue = target[property]
                            let sanitizedValue, sanitizerDetails, validatedValue, validatorDetails;
                            switch(property[0]) {
                            case '@':
                                return $this.setAttribute(property.slice(1), value)
                            case '.':
                                return $this[property.slice(1)] = value
                            case '#':
                                let cleanProperty = property.slice(1);
                                [sanitizedValue, sanitizerDetails] = $this.eSchema.sanitize($this, cleanProperty, value)
                                value = sanitizedValue;
                                [validatedValue, validatorDetails] = $this.eSchema.validate($this, cleanProperty, value)
                                return {property: cleanProperty, value: value, oldValue: oldValue, sanitizedValue: sanitizedValue, 
                                    validatedValue: validatedValue, sanitizerDetails: sanitizerDetails, validatorDetails: validatorDetails}
                            default:
                                [sanitizedValue, sanitizerDetails] = $this.eSchema.sanitize($this, property, value)
                                if (sanitizedValue !== value) ElementHTML._dispatchPropertyEvent($this, 'sanitized', property, {
                                            property: property, givenValue: value, sanitizedValue: sanitizedValue, sanitizerDetails: sanitizerDetails
                                        })
                                value = sanitizedValue;
                                if (oldValue === value) return value
                                if (!(value instanceof Object)) target[property] = value
                                $this.eRender('set', property, value);
                                [validatedValue, validatorDetails] = $this.eSchema.validate($this, property, value)
                                if (validatedValue !== value) ElementHTML._dispatchPropertyEvent($this, 'validated', property, {
                                            property: property, givenValue: value, validatedValue: validatedValue, validatorDetails: validatorDetails
                                        })
                                ElementHTML._dispatchPropertyEvent($this, 'change', property, {
                                    property: property, value: value, oldValue: oldValue, sanitizedValue: sanitizedValue, 
                                    validatedValue: validatedValue, sanitizerDetails: sanitizerDetails, validatorDetails: validatorDetails
                                })
                                return value
                            }
                        },
                        deleteProperty(target, property) {
                            const oldValue = target[property]
                            let validatedValue, validatorDetails
                            switch(property[0]) {
                            case '@':
                                return $this.removeAttribute(property.slice(1))
                            case '.':
                                return delete $this[property.slice(1)]
                            case '#':
                                const cleanProperty = property.slice(1);
                                [validatedValue, validatorDetails] = $this.eSchema.validate($this, cleanProperty, undefined)
                                return {property: cleanProperty, value: undefined, oldValue: oldValue, validatedValue: validatedValue, validatorDetails: validatorDetails}
                            default:
                                let retval = delete target[property]
                                $this.eRender('deleteProperty', property);
                                [validatedValue, validatorDetails] = $this.eSchema.validate($this, property, undefined)
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
                     window.requestAnimationFrame(() => {
                        this.readyCallback()
                        this.dispatchEvent(new CustomEvent('ready'))
                     })
                } catch(e) {}
            }
            static get observedAttributes() { 
                return ['valueproxy'] 
            }
            static e = ElementHTML
            async connectedCallback() {
                for (const property in this.dataset) this.eRender('set', property, this.dataset[property])
            }
            async readyCallback() {}
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