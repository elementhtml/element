const ElementHTML = Object.defineProperties({}, {
    version: {enumerable: true, value: '0.8.0'},
    env: {enumerable: true, value: Object.defineProperties({}, {
        eDataset: {enumerable: true, value: new EventTarget()},
        globalLoadCalled: {configurable: true, enumerable: true, writable: true, value: false},
        modes: {configurable: true, enumerable: true, writable: true, value: {
            element: 'html', layout: 'html', content: 'html', meta: 'html', theme: 'css',
            data: 'json', media: 'webp', processor: 'js', schema: 'schema.json', context: 'context.json'
        }},
        routableLoadingRegistry: {enumerable: true, value: {}},
        proxies: {enumerable: true, value: {}},
        gateways: {enumerable: true, value: {
            ipfs: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipfs.dweb.link/')}`,
            ipns: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipns.dweb.link/')}`
        }},
        libraries: {enumerable: true, value: {}},
        options: {enumerable: true, value: Object.defineProperties({}, {
            security: {enumerable: true, value: {allowTemplateUseScripts: false, allowTemplateUseCustom: []}}
        })}
    })},
    utils: {enumerable: true, value: Object.defineProperties({}, {
        splitOnce: {enumerable: true, value: function(str, delimiter) {
            let r
            str.split(delimiter).some((e,i,a) => r = a.length<=2?(a):[a[0], a.slice(1).join(delimiter)])
            return r
        }},
        getCustomTag: {enumerable: true, value: function(element) {
            return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                    || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
        }}, 
        wait: {enumerable: true, value: async function(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms))
        }}, 
        waitUntil: {enumerable: true, value: async function(cb, ms=100, max=100) {
            let count = 0
            while ((count <= max) && !cb()) { await ElementHTML.utils.wait(ms); count = count + 1 }
        }}, 
        parseObjectAttribute: {enumerable: true, value: function(value) {
            let retval = null
            if (value instanceof Object) {
                retval = value
            } else if (typeof value === 'string') {
                if ((value[0] === '{') && (value.slice(-1) === '}')) {
                    try { retval = JSON.parse(value) } catch(e) {}
                } else {
                    try { retval = Object.fromEntries((new URLSearchParams(value)).entries()) } catch(e) {}
                }
            }
            return retval
        }}
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
        if (!rootElement) {
            if (this.env.globalLoadCalled) return
            Object.defineProperty(this.env, 'globalLoadCalled', {enumerable: true, value: true})
            Object.defineProperty(this.env, 'ElementHTML', {enumerable: true, value: this})
            Object.freeze(this.env.options.security)
            Object.freeze(this.env.proxies)
            Object.freeze(this.env.gateways)
            const newModes = {}
            for (const [mode, suffix] of Object.entries(this.env.modes)) {
                Object.defineProperty(newModes, mode, {enumerable: true, value: Object.defineProperties({}, {
                        pointer: {enumerable: true, value: mode}, suffix: {enumerable: true, value: suffix}
                    })
                })
            }
            Object.defineProperty(this.env, 'modes', {enumerable: true, value: newModes})
            this._enscapulateNative()
        }
        rootElement && await this.activateTag(this.utils.getCustomTag(rootElement), rootElement)
        if (rootElement && !rootElement.shadowRoot) return
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) if (this.utils.getCustomTag(element)) await this.load(element)
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
                if (this.utils.getCustomTag(addedNode)) await this.load(addedNode)
                if (addedNode.parentElement === document.head) parseHeadMeta(addedNode)
            }
        })
        observerRoot._observer.observe(domRoot, {subtree: true, childList: true})
        if (!rootElement) for (const metaElement of document.head.children) parseHeadMeta(metaElement)
    }},
    expose: {enumerable: true, value: function(globalName='ElementHTML') {
        if (globalName && !window[globalName]) window[globalName] = this
    }},
    getURL: {enumerable: true, value: function(value) {
        if (value.startsWith('http://') || value.startsWith('https://') || !value.includes('://')) return value
        const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
        value = typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath) : value
        for (const [k, v] of Object.entries(this.env.proxies)) if (value.startsWith(k)) value = value.replace(k, v)
        return value
    }},
    resolveForElement: {enumerable: true, value: function(element, tagName, conditions={}, searchBody=false, equals={}, startsWith={}, includes={}) {
        let resolved
        const testNode = (node, useConditions=false) => {
            if (useConditions) for (const [attrName, testValue] of Object.entries(conditions)) if (node.getAttribute(attrName) != testValue) return
            for (const [attrName, testValue] of Object.entries(equals)) if (node.getAttribute(attrName) == testValue) return node
            for (const [attrName, testValue] of Object.entries(startsWith)) if (node.getAttribute(attrName).startsWith(testValue)) return node
            for (const [attrName, testValue] of Object.entries(includes)) if (` ${node.getAttribute(attrName)} `.includes(testValue)) return node
            if (!Object.keys(equals).length && !Object.keys(startsWith).length && !Object.keys(includes).length) return node
        }, query = Object.keys(conditions).length ?  `${tagName}[${Object.entries(conditions).map(e => e[0]+'="'+e[1]+'"').join('][') }]` : tagName
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
    }},
    resolveMeta: {enumerable: true, value: function(element, is, name) {
        let metaElement
        const rootNode = element.shadowRoot || element.getRootNode()
        return name ? rootNode.querySelector(`meta[is="${is}"][name="${name}"]`) : rootNode.querySelector(`meta[is="${is}"]`) 
    }},
    activateTag: {enumerable: true, value: async function(tag, element, forceReload=false) {
        if (!tag || (!forceReload && this.ids[tag]) || !tag.includes('-')) return
        const id = await this.getTagId(tag, element);
        [this.ids[tag], this.tags[id]] = [id, tag]
        const loadResult = await this.loadTagAssetsFromId(id, forceReload)
        if (!loadResult) return
        const baseTag = this.getInheritance(id).pop() || 'HTMLElement'
        globalThis.customElements.define(tag, this.constructors[id], (baseTag && baseTag !== 'HTMLElement' & !baseTag.includes('-')) ? {extends: baseTag} : undefined)
    }},
    getTagId: {enumerable: true, value: async function(tag, element) {
        if (this.ids[tag]) return this.ids[tag]
        const [routerName, pointer] = tag.split('-', 2).map(t => t.toLowerCase())
        let tagRouter = this.resolveMeta(element, 'e-router', routerName)
        return await tagRouter?.element(pointer) || (new URL(`./${(routerName)}/element/${pointer}.html`,
            routerName === 'e' ? import.meta.url : element.baseURI)).href
    }},
    loadTagAssetsFromId: {enumerable: true, value: async function(id, forceReload=false) {
        if (!id || !id.includes('://') || (!forceReload && this.files[id])) return
        const fileFetch = await fetch(this.getURL(id))
        if (fileFetch.status >= 400) return
        this.files[id] = await fileFetch.text()
        this.styles[id] = this.files[id].slice(this.files[id].indexOf('<style>')+7, this.files[id].indexOf('</style>')).trim()
        this.templates[id] = this.files[id].slice(this.files[id].indexOf('<template>')+10, this.files[id].indexOf('</template>')).trim()
        this.scripts[id] = this.files[id].slice(this.files[id].indexOf('<script>')+8, this.files[id].indexOf('</script>')).trim()
        const extendsRegExp = /class\s+extends\s+`(?<extends>.*)`\s+\{/, ElementHTML = this
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
        this.constructors[id] = class extends this.classes[id] {constructor() {super()}}
        return true
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
        return observe ? (useScope.querySelector(observe) || useScope) : useScope
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
        if (!field || (typeof field !== 'string') || (field === '.')) return data
        const fieldedData = data, resultArray = [], fieldFrags = field.split(',').map(s => s.trim())
        for (const fieldFrag of fieldFrags) {
            let [fieldFragName, fieldFragVector] = fieldFrag.split(':', 2).map(s => s.trim()), thisData = data
            fieldFragVector ?? ([fieldFragVector, fieldFragName] = [fieldFragName, fieldFragVector])
            if (fieldFragVector === '.') { resultArray.push(fieldFragName ? ({[fieldFragName]: thisData }) : thisData); continue }
            for (const vector of fieldFragVector.split('.').map(s => s.trim())) {
                thisData = thisData[vector]
                if (!(thisData instanceof Object)) break
            }
            resultArray.push(fieldFragName ? ({[fieldFragName]: thisData }) : thisData)
        }
        return resultArray.length === 1 ? resultArray[0] : (resultArray.every(v => v instanceof Object) ? Object.assign({}, ...resultArray) : resultArray)
    }},
    getValue: {enumerable: true, value: function(element, useDataset='auto') {
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
            const retval = Object.assign({}, element.eDataset)
            for (const k of Object.keys(retval)) if (k.includes('__')) {
                const unsafeProperty = k.replaceAll('__', '-')
                retval[unsafeProperty] = retval[k]
                delete retval[k]
            }
            return retval
        } else {
            if (useDataset === 'auto') useDataset = !!Object.keys(element.dataset).length
            if (useDataset) return {...element.dataset}
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
        if (!element) return element
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
            } else { 
                Object.assign((element.eDataset || element.dataset), value) 
            }
            return element
        }
        let valueproxy
        if (element.eDataset instanceof Object && (valueproxy = element.getAttribute('valueproxy'))) {
            element.eDataset[valueproxy] = value
            if (value === undefined) delete element.eDataset[valueproxy]
            return element
        } else if (element.eDataset instanceof Object && value instanceof Object) {
            Object.assign(element.eDataset, value)
            return element
        }
        const tag = element.tagName.toLowerCase(), attrMethod = value === undefined ? 'removeAttribute': 'setAttribute'
        if (tag === 'meta') element[attrMethod]('content', value)
        if (['audio','embed','iframe','img','source','track','video'].includes(tag)) element[attrMethod]('src', value)
        if (['a','area','link'].includes(tag)) element[attrMethod]('href', value)
        if (tag === 'object') element[attrMethod]('data', value)
        if (['data','meter','input','select','textarea'].includes(tag)) (element.value = (value ??'')) || element[attrMethod]('value', value)
        if (tag === 'time') element[attrMethod]('datetime', value)
        element.textContent = value
        return element
    }},
    transformData: {enumerable: true, value: function(data, transformSignature) {
        if (!transformSignature || !data || !(data instanceof Object) || !Object.keys(data).length) return data
        const newData = Object.fromEntries(transformSignature.split(';').map(s => s.trim().split(':').map(ss => ss.trim())))
        for (const k of Object.keys(newData)) if (newData[k] in data) newData[k] = data[newData[k]]
        return newData
    }},
    sinkData: {enumerable: true, value: function(element, data, flag, transform, sourceElement, context={}, layer=0, rootElement=undefined) {
        if (!element) return element
        rootElement ||= element
        if (transform) data = this.transformData(data, transform)
        if (!(data instanceof Object)) return this.setValue(element, data)
        if (!Object.keys(data).length) return element
        flag ||= sourceElement?.flag
        if (element === document.head || element === document || (element === sourceElement && sourceElement?.parentElement === document.head)) {
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
          return element
        }
        const tag = element.tagName.toLowerCase()
        if (flag === '@') {
          for (const [k, v] of Object.entries(data)) element.setAttribute(k, v)
        } else if (flag === '.') {
          for (const [k, v] of Object.entries(data)) element[k] = v
        } else if (flag === 'dataset') {
          for (const [k, v] of Object.entries(data)) element.dataset[k] = v
        } else if (flag === 'eDataset' && element.eDataset instanceof Object) {
          Object.assign(element.eDataset, data)
        } else if (flag === 'eContext' && element.eContext instanceof Object) {
          Object.assign(element.eContext, data)
        } else if (flag && flag.startsWith('auto')) {
          if (element.eDataset instanceof Object) {
            Object.assign(element.eDataset, data)
          } else {
            for (const [k, v] of Object.entries(data)) {
              if (k.startsWith('@')) element.setAttribute(k.slice(1), v)
              if (k.startsWith('.')) element[k.slice(1)] = v
              if (flag === 'auto-data') element.dataset[k] = v
            }
          }
        } else if (flag && ((flag.startsWith('...')) || (typeof element[flag] === 'function'))) {
          if (flag.startsWith('...')) {
            const sinkFunctionName = flag.slice(3)
            if (typeof element[sinkFunctionName] === 'function') {
              element[sinkFunctionName](...data)
            } else if (element[sinkFunctionName] instanceof Object) {
              element[sinkFunctionName] = {...element[sinkFunctionName], ...data}
            }
          } else { element[flag](data) }
        } else if (flag && element[flag] instanceof Object) {
          Object.assign(element[flag], data)
        } else if (element.querySelector(':scope > template')) {
            let after = element.querySelector(`:scope > template:last-of-type`)
            const filterTemplates = (templates, value, data) => {
                if (!templates.length) return
                const matchingTemplates = [], ops = {'=': (c,v) => v == c, '!': (c,v) => v != c, '<': (c,v) => v < c, '>': (c,v) => v > c, '%': (c,v) => !!(v % c), 
                    '~': (c,v) => !(v % c), '^': (c,v) => `${v}`.startsWith(c), '$': (c,v) => `${v}`.endsWith(c), 
                    '*': (c,v) => `${v}`.includes(c), '-': (c,v) => !`${v}`.includes(c), 
                    '+': (c,v) => `${v}`.split(' ').includes(c), '_': (c,v) => !`${v}`.split(' ').includes(c), 
                    '/': (c,v) => (new RegExp(...this.utils.splitOnce(c.split('').reverse().join(''), '/').map(s => s.s.split("").reverse().join("")))).test(`${v}`)}
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
            }, build = template => {
                for (const useTemplate of template.content.querySelectorAll('template[data-e-use]')) {
                    const fragmentsToUse = []
                    for (const use of (useTemplate.getAttribute('data-e-use') || '').split(';')) {
                        if (use.startsWith('`') && use.endsWith('`')) {
                            const htmlFragment = document.createElement('div')
                            typeof htmlFragment.setHTML === 'function' ? htmlFragment.setHTML(use.slice(1, -1)) : (htmlFragment.innerHTML = use.slice(1, -1))
                            for (const element of htmlFragment.querySelectorAll('*')) {
                                const tag = element.tagName.toLowerCase()
                                if (tag==='script' && !this.env.options.security.allowTemplateUseScripts) element.remove()
                                if (tag.includes('-') && !tag.startsWith('e-') && !this.env.options.security.allowTemplateUseCustom.includes(tag)) element.remove()
                            }
                            fragmentsToUse.push(...Array.from(htmlFragment.children).map(c => c.cloneNode(true)))
                        } else {
                            const fragmentToUse = this.resolveForElement(rootElement, 'template', {'data-e-fragment': use}, true)
                            if (fragmentToUse) fragmentsToUse.push(...Array.from(fragmentToUse.content.children).map(c => c.cloneNode(true)))
                        }
                    }
                    useTemplate.replaceWith(...fragmentsToUse.map(n => n.cloneNode(true)))
                }
                return template
            }, querySuffix = ':not([data-e-fragment]):not([data-e-use])'
            for (const [key, value] of Object.entries(data)) {
                let entryTemplate = filterTemplates(element.querySelectorAll(`:scope > template[data-e-property="${key}"]:not([data-e-key])${querySuffix}`), value, data)
                    || filterTemplates(element.querySelectorAll(`:scope > template:not([data-e-property]):not([data-e-key])${querySuffix}`), value, data)
                if (entryTemplate) {
                    const recursiveTemplates = element.querySelectorAll(':scope > template[data-e-place-into]'),
                        entryNode = build(entryTemplate).content.cloneNode(true), keyTemplate = filterTemplates(entryNode.querySelectorAll(`template[data-e-key]${querySuffix}`), value, data)
                    let valueTemplates = entryNode.querySelectorAll(`template[data-e-value]${querySuffix}`)
                    if (keyTemplate) keyTemplate.replaceWith(this.setValue(build(keyTemplate).content.cloneNode(true).children[0] || '', key))
                    if (!valueTemplates.length) valueTemplates = entryNode.querySelectorAll(`template:not([data-e-key])${querySuffix}`)
                    if (valueTemplates.length) {
                        let valueTemplate = valueTemplates[valueTemplates.length-1]
                        for (const t of valueTemplates) {
                            if (t.getAttribute('data-e-fragment') || t.getAttribute('data-e-use')) continue
                            const templateDataType = t.getAttribute('data-e-if-type')
                            if ((value?.constructor?.name?.toLowerCase() === templateDataType) || ((templateDataType === 'object') && (value instanceof Object))
                                || ((templateDataType === 'scalar') && !(value instanceof Object))) { valueTemplate = t; break }
                        }
                        const valueNode = build(valueTemplate).content.cloneNode(true)
                        for (const recursiveTemplate of recursiveTemplates) {
                            let placed = false
                            for (const scopedTarget of valueNode.querySelectorAll(recursiveTemplate.getAttribute('data-e-place-into'))) {
                                scopedTarget.prepend(recursiveTemplate.cloneNode(true))
                                placed = true
                            }
                            if (!placed && (value instanceof Object)) valueNode.prepend(recursiveTemplate.cloneNode(true))
                        }
                        this.sinkData(valueNode.children[0], value, flag, transform, sourceElement, context, layer+1, element)
                        valueTemplate.replaceWith(...valueNode.children)
                    }
                    if (!keyTemplate && !valueTemplates.length) this.sinkData(entryNode.children[0], value, flag, transform, sourceElement, context, layer+1, element)
                    if (entryTemplate.getAttribute('data-e-property')) {
                        entryTemplate.after(...entryNode.children)
                    } else {
                        const nextAfter = entryNode.children[entryNode.children.length-1]
                        after.after(...entryNode.children)
                        after = nextAfter
                    }
                }
            }
            for (const template of element.querySelectorAll('template')) template.remove()
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
          } else if (tag === 'input' && sourceElement) {
            const datalist = document.createElement('datalist')
            datalist.replaceChildren(...optionElements)
            sourceElement.dataset.datalistId = crypto.randomUUID()
            datalist.setAttribute('id', sourceElement.dataset.datalistId)
            document.body.append(datalist)
            element.setAttribute('list', sourceElement.dataset.datalistId)
          }
        } else if (['form', 'fieldset'].includes(tag)) {
            for (const [k, v] of Object.entries(data)) (element.querySelector([name="${k}"])||{}).value = v
        } else if (['table', 'tbody'].includes(tag)) {
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
        } else {
            if (element.eDataset instanceof Object) {
                Object.assign(element.eDataset, data)
            } else {
                for (const [k, v] of Object.entries(data)) {
                    if (k.startsWith('@')) {
                        element.setAttribute(k.slice(1), v)
                    } else if (k.startsWith('.')) {
                        element[k.slice(1)] = v
                    } else {
                        element.dataset[k] = v
                    }
                }
            }
        }
        return element
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
        const HTMLElements = ['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em', 'figcaption', 'figure', 'footer', 'header',
            'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr']
        for (const tag of HTMLElements) this.ids[tag] = 'HTMLElement'
        Object.assign(this.ids, {a: 'HTMLAnchorElement', blockquote: 'HTMLQuoteElement', br: 'HTMLBRElement', caption: 'HTMLTableCaptionElement', col: 'HTMLTableColElement',
            colgroup: 'HTMLTableColElement', datalist: 'HTMLDataListElement', del: 'HTMLModElement', dl: 'HTMLDListElement', fieldset: 'HTMLFieldSetElement',
            h1: 'HTMLHeadingElement', h2: 'HTMLHeadingElement',  h3: 'HTMLHeadingElement', h4: 'HTMLHeadingElement', h5: 'HTMLHeadingElement', h6: 'HTMLHeadingElement', hr: 'HTMLHRElement',
            iframe: 'HTMLIFrameElement', img: 'HTMLImageElement', ins: 'HTMLModElement', li: 'HTMLLIElement', ol: 'HTMLOListElement', optgroup: 'HTMLOptGroupElement',
            p: 'HTMLParagraphElement', q: 'HTMLQuoteElement', tbody: 'HTMLTableSectionElement', td: 'HTMLTableCellElement', textarea: 'HTMLTextAreaElement',
            tfoot: 'HTMLTableSectionElement', th: 'HTMLTableCellElement', th: 'HTMLTableSectionElement', tr: 'HTMLTableRowElement', ul: 'HTMLUListElement' })
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
    _connectElement: {value: async function() {
        let scope = this.scope ? this.closest(this.scope) : this.getRootNode()
        scope ||= this.getRootNode()
        let sourceElement = (scope instanceof ShadowRoot) ? scope.host : ( this.scope ? scope : this.parentElement )
        const trimmedContent = this.textContent.trim()
        if (trimmedContent.length && !this.children.length) {
            if (this.source) {
                this.query = trimmedContent
            } else if (this.query) {
                this.source = trimmedContent
            } else if (trimmedContent.includes('~>')) {
                const [source, ...query] = trimmedContent.split('~>')
                this.source = source.trim()
                this.query = query.join('~>').trim()
            } else {
                this.source = ''
                this.query = trimmedContent
            }
        }
        if (this.source) sourceElement = sourceElement.querySelector(this.source)
        if (!sourceElement || (sourceElement === this)) return
        this.sourceElement = sourceElement
        sourceElement.addEventListener('change', event => { this.render(sourceElement) })
        await this.render(sourceElement)
    }},
    _renderElement: {value: async function(sourceElement) {
        if (this.hasAttribute('jsonata') && !window.jsonata) {
            const scriptTag = document.createElement('script')
            scriptTag.setAttribute('src', 'https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js')
            document.head.append(scriptTag)
            await this.e.utils.waitUntil(() => window.jsonata)
        }
        const [t='true', f='false', n='', u=''] = this.map.split(',')
        let newValue = this.e.getValue(sourceElement)
        if (this.query) {
            if (window.jsonata) {
                try { newValue = await window.jsonata(this.query).evaluate(newValue) } catch(e) { this.dispatchEvent(new CustomEvent('error', {detail: {message: e.message, jsonataError: e, value: newValue, query: this.query}})) }
            } else {
                try { newValue = newValue[this.query] } catch(e) { this.dispatchEvent(new CustomEvent('error', {detail: {message: e, value: newValue, query: this.query}})) }
            }
        }
        if (this.processor) {
            let processorFunction = this.e.resolveMeta(this, 'e-processor', this.processor)?.func
            if (processorFunction) useResponse = await processorFunction(newValue)
        }
        if (newValue === true) newValue = t
        if (newValue === false) newValue = f
        if (newValue === null) newValue = n
        if (newValue === undefined) newValue = u
        if (this.children.length) {
            if (Array.isArray(newValue)) {
                for (const [i, v] of newValue.entries()) this.e.setValue(this.children[i], v)
            } else if ((newValue instanceof Object) && this.querySelectorAll('[name]').length) {
                for (const [k, v] of Object.entries(newValue)) this.e.setValue(this.querySelector(`[name="${k}"]`), v)
            } else { this.e.setValue(this.children[0], newValue) }
        } else { this.textContent = newValue }
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
                    eContext: {enumerable: true, writable: true, value: {}},
                    eData: {enumerable: true, writable: true, value: {}},
                    eSchema: {enumerable: true, writable: true, value: null},
                    eDataset: {enumerable: true, value: new Proxy($this.dataset, {
                        has(target, property) {
                            switch(property[0]) {
                            case '@':
                                return $this.hasAttribute(property.slice(1))
                            case '.':
                                return property.slice(1) in $this
                            default:
                                return property.includes('-') ? (property.replaceAll('-', '__') in target) : (property in target)
                            }
                        },
                        get(target, property, receiver) {
                            switch(property[0]) {
                            case '@':
                                return $this.getAttribute(property.slice(1))
                            case '.':
                                return $this[property.slice(1)]
                            default:
                                return property.includes('-') ? target[property.replaceAll('-', '__')] : target[property]
                            }
                        },
                        set(target, property, value, receiver) {
                            switch(property[0]) {
                            case '@':
                                return $this.setAttribute(property.slice(1), value)
                            case '.':
                                return $this[property.slice(1)] = value
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
                                ElementHTML._dispatchPropertyEvent($this, 'change', property, {property: property, value: value, oldValue: oldValue})
                                return value
                            }
                        },
                        deleteProperty(target, property) {
                            switch(property[0]) {
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
                                ElementHTML._dispatchPropertyEvent($this, 'deleteProperty', property, {property: property, value: undefined, oldValue: oldValue})
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
                        this.dispatchEvent(new CustomEvent('ready'))
                        this.readyCallback()
                     })
                } catch(e) {}
            }
            static get observedAttributes() { return ['valueproxy'] }
            static e = ElementHTML
            async connectedCallback() { this.dispatchEvent(new CustomEvent('connected')) }
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
let metaUrl = new URL(import.meta.url), metaSearch = metaUrl.search.slice(1)
if (metaSearch) for (const [func, args=[]] of (metaSearch.split(';').map(f => ([...f.split('(', 2), undefined].slice(0, 2))).map(f => [f[0], f[1] !== undefined ? (f[1].slice(0, -1).split(',')):[]]))) if (typeof ElementHTML[func] == 'function') await ElementHTML[func](...args)  
export { ElementHTML }