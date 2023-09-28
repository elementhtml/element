const ElementHTML = Object.defineProperties({}, {
    version: {enumerable: true, value: '0.9.0'},
    env: {enumerable: true, value: Object.defineProperties({}, {
        eDataset: {enumerable: true, value: new EventTarget()},
        globalLoadCalled: {configurable: true, enumerable: true, writable: true, value: false},
        modes: {configurable: true, enumerable: true, writable: true, value: {
            element: 'element/element.html', content: 'content/content.html', data: 'data/data.json', 
            theme: 'theme/theme.css', schema: 'schema/schema.schema.json', processor: 'processor/process.js'
        }},
        loadingRegistry: {enumerable: true, value: {}},
        proxies: {enumerable: true, value: {}},
        gateways: {enumerable: true, value: {
            ipfs: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipfs.dweb.link/')}`,
            ipns: hostpath => `https://${this.utils.splitOnce(hostpath, '/').join('.ipns.dweb.link/')}`
        }},
        libraries: {enumerable: true, value: {}},
        options: {enumerable: true, value: Object.defineProperties({}, {
            security: {enumerable: true, value: {allowTemplateUseScripts: false, allowTemplateUseCustom: []}}, 
            errors: {enumerable: true, value: 'hide'}, 
            fetchOptions: {enumerable: true, value: {}},
            rewriteRules: {enumerable: true, value: {}},
            ajv: {enumerable: true, value: {allErrors: true, verbose: true, validateSchema: 'log', 
                strictSchema: false, strictTypes: false, strictTuples: false, allowUnionTypes: true, allowMatchingProperties: true}}
        })}
    })},
    utils: {enumerable: true, value: Object.defineProperties({}, {
        getCustomTag: {enumerable: true, value: function(element) {
            return (element instanceof HTMLElement && element.tagName.includes('-') && element.tagName.toLowerCase())
                    || (element instanceof HTMLElement && element.getAttribute('is')?.includes('-') && element.getAttribute('is').toLowerCase())
        }}, 
        parseObjectAttribute: {enumerable: true, value: function(value) {
            let retval = null
            if (value instanceof Object) {
                retval = value
            } else if (typeof value === 'string') {
                if (value[0] === '?') value = decodeURIComponent(value).slice(1)
                if ((value[0] === '{') && (value.slice(-1) === '}')) {
                    try { retval = JSON.parse(value) } catch(e) {}
                } else {
                    try { retval = Object.fromEntries((new URLSearchParams(value)).entries()) } catch(e) {}
                }
            }
            return retval
        }}, 
        resolveMeta: {enumerable: true, value: function(element, is, name) {
            let metaElement
            const rootNode = element.shadowRoot || element.getRootNode()
            return name ? rootNode.querySelector(`meta[is="${is}"][name="${name}"]`) : rootNode.querySelector(`meta[is="${is}"]`) 
        }},
        splitOnce: {enumerable: true, value: function(str, delimiter) {
            let r
            str.split(delimiter).some((e,i,a) => r = a.length<=2?(a):[a[0], a.slice(1).join(delimiter)])
            return r
        }},
        wait: {enumerable: true, value: async function(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms))
        }}, 
        waitUntil: {enumerable: true, value: async function(cb, ms=100, max=100) {
            let count = 0
            while ((count <= max) && !cb()) { await ElementHTML.utils.wait(ms); count = count + 1 }
        }}
    })},
    ids: {enumerable: true, value: {}},
    tags: {enumerable: true, value: {}},
    extends: {enumerable: true, value: {}},
    files: {enumerable: true, value: {}},
    styles: {enumerable: true, value: {}},
    _styles: {enumerable: false, value: {}},
    templates: {enumerable: true, value: {}},
    _templates: {enumerable: false, value: {}},
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
            for (const [mode, signature] of Object.entries(this.env.modes)) {
                let [path, pointer, ...suffix] = signature.split('/').map(s => s.split('.')).flat()
                suffix = suffix.join('.')
                Object.defineProperty(newModes, mode, {enumerable: true, value: Object.defineProperties({}, {
                        path: {enumerable: true, value: path }, 
                        pointer: {enumerable: true, value: pointer}, suffix: {enumerable: true, value: suffix}
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
                if (typeof addedNode?.querySelectorAll === 'function') for (const n of addedNode.querySelectorAll('*')) if (this.utils.getCustomTag(n)) await this.load(n)
                if (addedNode.parentElement === document.head) parseHeadMeta(addedNode)
            }
        })
        observerRoot._observer.observe(domRoot, {subtree: true, childList: true})
        if (!rootElement) for (const metaElement of document.head.children) parseHeadMeta(metaElement)
    }},
    expose: {enumerable: true, value: function(globalName='ElementHTML') {
        if (globalName && !window[globalName]) window[globalName] = this
    }},
    errors: {enumerable: true, value: function(mode='hide') {
        mode = ['throw', 'show', 'hide'].includes(mode) ? mode : 'hide'
        this.env.options.errors = mode
    }},
    getURL: {enumerable: true, value: function(value) {
        if (!value.includes('://')) return value
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
            const [protocol, hostpath] = value.split(/\:\/\/(.+)/)
            value = typeof this.env.gateways[protocol] === 'function' ? this.env.gateways[protocol](hostpath) : value
        } 
        for (const [k, v] of Object.entries(this.env.proxies)) if (value.startsWith(k)) value = value.replace(k, v)
        return value
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
        let tagRouter = this.utils.resolveMeta(element, 'e-router', routerName)
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
    resolveForElement: {enumerable: true, value: function(element, tagName, conditions={}, searchBody=false, equals={}, startsWith={}, includes={}) {
        let resolved
        const testNode = (node, useConditions=false) => {
            if (useConditions) for (const [attrName, testValue] of Object.entries(conditions)) if (node.getAttribute(attrName) != testValue) return
            for (const [attrName, testValue] of Object.entries(equals)) if (node.getAttribute(attrName) == testValue) return node
            for (const [attrName, testValue] of Object.entries(startsWith)) if (node.getAttribute(attrName).startsWith(testValue)) return node
            for (const [attrName, testValue] of Object.entries(includes)) if (` ${node.getAttribute(attrName)} `.includes(testValue)) return node
            if (!Object.keys(equals).length && !Object.keys(startsWith).length && !Object.keys(includes).length) return node
        }, query = Object.keys(conditions).length ? `${tagName}[${Object.entries(conditions).map(e => e[0]+'="'+e[1]+'"').join('][') }]` : tagName
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
            const eValueProxy = element.getAttribute('e-value-proxy')
            if (eValueProxy) return element.eDataset[eValueProxy]
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
            if (['data','meter','input','select','textarea'].includes(tag)) return element.value
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
        } else {
            if (element.eDataset instanceof Object && element.eValueProxy) {
                element.eDataset[element.eValueProxy] = value
                if (value === undefined) delete element.eDataset[element.eValueProxy]
            } else {
                const tag = element.tagName.toLowerCase(), attrMethod = value === undefined ? 'removeAttribute': 'setAttribute'
                if (tag === 'meta') { element[attrMethod]('content', value); return }
                if (['audio','embed','iframe','img','source','track','video'].includes(tag)) { element[attrMethod]('src', value); return }
                if (['a','area','link'].includes(tag)) { element[attrMethod]('href', value); return }
                if (tag === 'object') { element[attrMethod]('data', value); return }
                if (['data','meter','input','select','textarea'].includes(tag)) { element.value = (value ??''); return }
                if (tag === 'time') { element[attrMethod]('datetime', value); return }
                element.textContent = value
            }
        }
        element.dispatchEvent(new CustomEvent('change', {detail: {value, scopeNode}}))        
        return element        
    }},
    sinkData: {enumerable: true, value: async function(element, data, flag, transform, sourceElement, context={}, layer=0, rootElement=undefined) {
        if (!element) return element
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
            if (transform.includes('$target')) transform = `( $target := ${JSON.stringify(this.getValue(element))} ; ${transform})`
            if (transform.includes('$node')) transform = `( $node := ${JSON.stringify(this.getValue(element))} ; ${transform})`
            data = await this.env.libraries.jsonata(transform).evaluate(data)
        }
        if (data instanceof Node) {
            if (data.eDataset) {
                data = Object.assign({}, data.eDataset)
            } else {
                data = {...data.dataset, 
                    ...Object.fromEntries(data.getAttributeNames().map(a => ([`@${a}`, data.getAttribute(a)]))), 
                    ...Object.fromEntries(['innerHTML', 'innerText', 'textContent', 'value'].map(p => ([`.${p}`, data[p]])))
                }
            }
        }
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
          for (const [k, v] of Object.entries(data)) (v === null || v === undefined) ? element.removeAttribute(k) : element.setAttribute(k, v)
        } else if (flag === '.') {
          for (const [k, v] of Object.entries(data)) (v === null || v === undefined) ? delete element[k] : element[k] = v
        } else if (flag === 'dataset') {
          for (const [k, v] of Object.entries(data)) element.dataset[k] = v
        } else if (flag === 'eDataset' && element.eDataset instanceof Object) {
          Object.assign(element.eDataset, data)
        } else if (flag === 'eData' && element.eData instanceof Object) {
          Object.assign(element.eData, data)
        } else if (flag === 'eContext' && element.eContext instanceof Object) {
          Object.assign(element.eContext, data)
        } else if (flag && flag.startsWith('auto')) {
          if (element.eDataset instanceof Object) {
            Object.assign(element.eDataset, data)
          } else {
            for (const [k, v] of Object.entries(data)) {
                let key = k, target = element
                if (key.startsWith('$')) {
                    let [qs, kk] = this.utils.splitOnce(k, ')')
                    qs = qs.slice(2).trim()
                    key = kk
                    if (!qs) continue
                    target = target.querySelector(qs)
                    if (!target) continue
                }
                if (key.startsWith('@')) {
                    (v === null || v === undefined) ? target.removeAttribute(k.slice(1)) : target.setAttribute(key.slice(1), v)
                } else if (key.startsWith('.')) {
                    (v === null || v === undefined) ? delete target[k.slice(1)] : target[key.slice(1)] = v
                } else if (flag === 'auto-data') {
                    target.dataset[key] = v
                }
            }
          }
        } else if (flag && ((flag.startsWith('...')) || (typeof element[flag] === 'function'))) {
          if (flag.startsWith('...')) {
            const sinkFunctionName = flag.slice(3)
            if (typeof element[sinkFunctionName] === 'function') {
              element[sinkFunctionName](...data)
            } else if (!element[sinkFunctionName] || (element[sinkFunctionName] instanceof Object)) {
              element[sinkFunctionName] = {...(element[sinkFunctionName] ?? {}), ...data}
            }
          } else { element[flag](data) }
        } else if (flag && element[flag] instanceof Object) {
          Object.assign(element[flag], data)
        } else if (element.querySelector(':scope > template')) {
            let after = document.createElement('meta')
            after.toggleAttribute('after', true)
            element.querySelector(`:scope > template:last-of-type`).after(after)
            while (after.nextElementSibling) after.nextElementSibling.remove()
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
            }, build = (template, key, value) => {
                for (const useTemplate of template.content.querySelectorAll('template[data-e-use]')) {
                    const fragmentsToUse = []
                    for (let use of (useTemplate.getAttribute('data-e-use') || '').split(';')) {
                        if (use.startsWith('`') && use.endsWith('`')) {
                            const htmlFragment = document.createElement('div')
                            if (useTemplate.dataset.eMerge) {
                                const eMerge = (this.utils.parseObjectAttribute(useTemplate.dataset.eMerge) || {})
                                for (const [k, v] of Object.entries(eMerge)) {
                                    if (k === '@') {
                                        use = use.replaceAll(eMerge[k] || k, `${key ?? ''}`)
                                    } else if (k === '$') {
                                        use = use.replaceAll(eMerge[k] || k, `${value ?? ''}`)
                                    } else { use = use.replaceAll(k, `${data[v] ?? ''}`) }
                                }
                            }
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
            const entries = Array.isArray(data) ? data.entries() : Object.entries(data)
            for (const [key, value] of entries) {
                let entryTemplate = filterTemplates(element.querySelectorAll(`:scope > template[data-e-property="${key}"]:not([data-e-key])${querySuffix}`), value, data)
                    || filterTemplates(element.querySelectorAll(`:scope > template:not([data-e-property]):not([data-e-key])${querySuffix}`), value, data)
                if (entryTemplate) {
                    const recursiveTemplates = element.querySelectorAll(':scope > template[data-e-place-into]'),
                        entryNode = build(entryTemplate, key, value).content.cloneNode(true), keyTemplate = filterTemplates(entryNode.querySelectorAll(`template[data-e-key]${querySuffix}`), value, data)
                    let valueTemplates = entryNode.querySelectorAll(`template[data-e-value]${querySuffix}`)
                    if (keyTemplate) keyTemplate.replaceWith(this.setValue(build(keyTemplate, key, value).content.cloneNode(true).children[0] || '', key))
                    if (!valueTemplates.length) valueTemplates = entryNode.querySelectorAll(`template:not([data-e-key])${querySuffix}`)
                    if (valueTemplates.length) {
                        let valueTemplate = valueTemplates[valueTemplates.length-1]
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
                        this.sinkData(valueNode.children[0], value, flag, transform, sourceElement, context, layer+1, element)
                        valueTemplate.replaceWith(...valueNode.children)
                    }
                    if (!keyTemplate && !valueTemplates.length) this.sinkData(entryNode.children[0], value, flag, transform, sourceElement, context, layer+1, element)
                    if (entryTemplate.getAttribute('data-e-property')) {
                        entryTemplate.after(...entryNode.children)
                    } else {
                        const nextAfter = entryNode.children[entryNode.children.length-1]
                        after?.after(...entryNode.children)
                        if (nextAfter) after = nextAfter
                    }
                }
            }
            element.querySelector('meta[after]')?.remove() 
        } else if (['input', 'select', 'datalist'].includes(tag)) {
          const optionElements = []
          for (const k in data) {
            const optionElement = document.createElement('option')
            optionElement.setAttribute('value', Array.isArray(data) ? data[k] : k)
            optionElement.textContent = data[k]
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
        } else if (['form', 'fieldset'].includes(tag)) {
            for (const [k, v] of Object.entries(data)) (element.querySelector([name=`${k}`])||{}).value = v
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
                    let key = k, target = element
                    if (key.startsWith('$')) {
                        let [qs, kk] = this.utils.splitOnce(k, ')')
                        qs = qs.slice(2).trim()
                        key = kk
                        if (!qs) continue
                        target = target.querySelector(qs)
                        if (!target) continue
                    }
                    if (key.startsWith('@')) {
                        (v === null || v === undefined) ? target.removeAttribute(k.slice(1)) : target.setAttribute(key.slice(1), v)
                    } else if (key.startsWith('.')) {
                        (v === null || v === undefined) ? delete target[k.slice(1)] : target[key.slice(1)] = v
                    } else { target.dataset[key] = v }
                }
            }
        }
        element.dispatchEvent(new CustomEvent('sinkData', {detail: {data, flag, transform, sourceElement, context, layer, rootElement}}))
        return element
    }},
    stackTemplates: {enumerable: true, value: function(id) {
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
    }},
    stackStyles: {enumerable: true, value: function(id) {
        if (typeof this._styles[id] === 'string') return this._styles[id]
        this._styles[id] = this.getInheritance(id).reverse().filter(id => this.styles[id]).map(id => `/** styles from '${id}' */\n` + this.styles[id]).join("\n\n")
        return this._styles[id]
    }},
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
    _dispatchPropertyEvent: {value: function(element, eventNamePrefix, property, eventDetail) {
        eventDetail = {detail: {property: property, ...eventDetail}}
        element.dispatchEvent(new CustomEvent(eventNamePrefix, eventDetail))
        element.dispatchEvent(new CustomEvent(`${eventNamePrefix}-${property}`, eventDetail))
    }},
    _base: {value: function(baseClass=globalThis.HTMLElement) {
        return class extends baseClass {
            #eValueProxy
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
                $this.constructor.eWasm ||= {}
                for (const moduleName in ($this.constructor.eWasm||{})) {
                    if ($this.constructor.eWasm[moduleName].module || $this.constructor.eWasm[moduleName].instance || !($this.constructor.eWasm[moduleName] instanceof Object)) continue
                    if (!$this.constructor.eWasm[moduleName].src) { $this.constructor.eWasm[moduleName] = false; continue } 
                    const {src, importObject} = $this.constructor.eWasm[moduleName]
                    $this.constructor.eWasm[moduleName] = true
                    WebAssembly.instantiateStreaming(fetch(ElementHTML.getURL(src)), importObject).then(importResult => 
                        $this.constructor.eWasm[moduleName] = importResult
                    ).catch(e => $this.constructor.eWasm[moduleName] = false)
                }
                Object.defineProperties($this, {
                    e: {enumerable: true, value: ElementHTML},
                    eContext: {enumerable: true, writable: true, value: {}},
                    eData: {enumerable: true, writable: true, value: {}},
                    eProcessor: {enumerable: true, writable: true, value: null},
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
                    })}
                })
                try {
                    $this.shadowRoot || $this.attachShadow({mode: 'open'})
                    $this.shadowRoot.textContent = ''
                    $this.shadowRoot.appendChild(document.createElement('style')).textContent = ElementHTML._styles[this.constructor.id] ?? ElementHTML.stackStyles(this.constructor.id)
                    const templateNode = document.createElement('template')
                    templateNode.innerHTML = ElementHTML._templates[this.constructor.id] ?? ElementHTML.stackTemplates(this.constructor.id)
                    $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
                     window.requestAnimationFrame(() => {
                        this.dispatchEvent(new CustomEvent('ready'))
                        this.readyCallback()
                     })
                } catch(e) {}
            }
            static get observedAttributes() { return ['e-value-proxy'] }
            static e = ElementHTML
            async connectedCallback() { this.dispatchEvent(new CustomEvent('connected')) }
            async readyCallback() {}
            attributeChangedCallback(attrName, oldVal, newVal) { if (oldVal !== newVal) this[attrName] = newVal }
            valueOf() { return this.e.getValue(this) }
            set ['e-value-proxy'](value) { this.#eValueProxy = value }
            get ['e-value-proxy']() { return this.#eValueProxy }
            set eValueProxy(value) { this.#eValueProxy = value }
            get eValueProxy() { return this.#eValueProxy }
        }
    }}
})
let metaUrl = new URL(import.meta.url), metaOptions = (ElementHTML.utils.parseObjectAttribute(metaUrl.search) || {})

if (!(metaOptions.expose && window[metaOptions.expose])) {
    if (metaOptions.expose) await ElementHTML.expose(metaOptions.expose) 
    for (const [func, args] of Object.entries(metaOptions)) if ((func !== 'expose') && (typeof ElementHTML[func] == 'function')) if (args.startsWith('[') && args.endsWith(']')) { 
        try { await ElementHTML[func](...JSON.parse(args)) } catch(e) { await ElementHTML[func](args) } 
    } else { await ElementHTML[func](args) }
}
export { ElementHTML }

