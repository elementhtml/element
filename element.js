const Element = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'},
    env: {configurable: false, enumerable: true, writable: false, value: {}},
    repositories: {configurable: false, enumerable: true, writable: false, value: {}},
    ids: {configurable: false, enumerable: true, writable: false, value: {}},
    tagNames: {configurable: false, enumerable: true, writable: false, value: {}},
    extends: {configurable: false, enumerable: true, writable: false, value: {}},
    files: {configurable: false, enumerable: true, writable: false, value: {}},
    styles: {configurable: false, enumerable: true, writable: false, value: {}},
    templates: {configurable: false, enumerable: true, writable: false, value: {}},
    scripts: {configurable: false, enumerable: true, writable: false, value: {}},
    classes: {configurable: false, enumerable: true, writable: false, value: {}},
    constructors: {configurable: false, enumerable: true, writable: false, value: {}},
    proxies: {configurable: false, enumerable: true, writable: false, value: {}},
    eventControllers: {configurable: false, enumerable: true, writable: false, value: {}},
    modules: {configurable: false, enumerable: true, writable: false, value: {}},
    processors: {configurable: false, enumerable: true, writable: false, value: {}},
    themes: {configurable: false, enumerable: true, writable: false, value: {}},
    appliedTheme: {configurable: false, enumerable: true, writable: true, value: undefined},
    _b37ElementObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _b37ElementThemeObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _eventTargets: {configurable: false, enumerable: false, writable: false, value: {}},
    eventTargets: {configurable: false, enumerable: true, writable: false, value: new Proxy(this._eventTargets, {
        get: (target, prop, receiver) => {
            if  (!(target[prop] instanceof EventTarget) && !(target[prop] instanceof Object 
                && target[prop].addEventListener instanceof Function && target[prop].removeEventListener instanceof Function 
                && target[prop].dispatchEvent instanceof Function)) {
                target[prop] = {
                    _: {}, 
                    addEventListener: (type, listener, options, element, doStatement) => {
                        if (!element || ! doStatement) return 
                        target[prop]._[element] ||= {}
                        target[prop]._[element][doStatement] ||= [type, listener, options]
                    },
                    removeEventListener: (type, listener, options, element, doStatement) => {
                        if (!element || ! doStatement) return 
                        target[prop]._[element] ||= {}
                        delete target[prop]._[element][doStatement]
                        !Object.keys(target[prop]._[element]).length && (delete target[prop]._[element])
                    },
                    dispatchEvent: () => {} 
                }
            }
            return target[prop]
        }, 
        has: (target, prop) => target[prop] instanceof EventTarget,
        set: function(target, prop, value, receiver) {
            if (value instanceof EventTarget) {
                if (!(target[prop] instanceof EventTarget) && (target[prop] instanceof Object) && (target[prop]._ instanceof Object)) for (const listenerParams of target[prop]._) value.addEventListener(...listenerParams)
                target[prop] = value
            }
        }
    })},
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && (tagName == 'Image' || tagName == 'Audio' || (tagName.startsWith('HTML') && tagName.endsWith('Element')))
    }},
    _runProcessors: {configurable: false, enumerable: false, writable: false, value: function(processorsSignature, input={}, element={}) {
        const processors = processorsSignature.split('|'), processorResult = {input: input, context: element?.b37Dataset||{}, env: this.env}
        for (processor of processors) {
            processorResult.input = await this._getModule(processor)
        }

    }},



    _doHandler: {configurable: false, enumerable: false, writable: false, value: function(event, processors, element) {
        let processorData = {}, b37EventDatasource = event.b37Datasource || element?.b37EventDatasource[event.type], 
            b37EventDatasink = event.b37Datasink || element?.b37EventDatasink[event.type] || element.b37Dataset
        if (b37EventDatasource) {
            if (event[b37EventDatasource] && typeof event[b37EventDatasource] === 'object') {
                processorData = event[b37EventDatasource]
            } else {
                try { processorData = JSON.parse(event[b37EventDatasource] || 'null')} catch(e) { processorData = {} }
            }
        } else if (event.formData instanceof FormData) {
            for (k in event.formData) processorData[k] = event.formData[k]
        } else {
            processorData = (event.detail instanceof Object && event.detail)
                || (event.data instanceof Object && event.data) || Object.assign({}, event.target.b37Dataset) || {}
        }
        processorData ||= {}
        for (const processor of processors) {
            if (typeof this.processors[processor] === 'function') {
                processorData = await this.processors[processor]((processorData && processorData==='object')?processorData:{}, event, element, this.env)
            }
        }
        if (b37EventDatasink && typeof b37EventDatasink === 'object') {
            if (processorData && typeof processorData === 'object') {
                Object.assign(b37EventDatasink, processorData)
            } else if (processorData && typeof processorData === 'string') {
                let parseTest = null
                try { parseTest = JSON.parse(processorData)} catch(e) { parseTest = null }
                if (parseTest && typeof parseTest === 'object') {
                    Object.assign(b37EventDatasink, parseTest)
                }
            }
        } else if (b37EventDatasink && typeof b37EventDatasink === 'string') {
            if (element[b37EventDatasink] && typeof element[b37EventDatasink] === 'object') {
                if (processorData && typeof processorData === 'object') {
                    Object.assign(element[b37EventDatasink], processorData)
                } else if (processorData && typeof processorData === 'string') {
                    let parseTest = null
                    try { parseTest = JSON.parse(processorData)} catch(e) { parseTest = null }
                    if (parseTest && typeof parseTest === 'object') {
                        Object.assign(element[b37EventDatasink], parseTest)
                    }
                }                
            } else {
                if (processorData && typeof processorData === 'string') {
                    let parseTest = null
                    try { parseTest = JSON.parse(processorData)} catch(e) { parseTest = null }
                    if (parseTest && typeof parseTest === 'object') {
                        element[b37EventDatasink] = parseTest
                    } else {
                        element[b37EventDatasink] = processorData
                    }
                }
            }
        }
    }},





    _getModule: {configurable: false, enumerable: false, writable: false, value: async function(tag, dryRun=false) {
        if (this.modules[tag]) return this.modules[tag]
        if (!tag.includes(':')) return undefined
        const [tagRepository, tagModule] = tag.split(':')
        if (!this.repositories[tagRepository]) return undefined
        const fileNameSuffix = tagModule.includes('.') ? tagModule.split('.', 2)[1] : this.repositories[tagRepository].modules.suffix || 'wasm',
            tagModuleFileName = tagModule.includes('.') ? tagModule : `${tagModule}.${fileNameSuffix}`
        if (fileNameSuffix === 'wasm') {
            const moduleObject = await WebAssembly.instantiateStreaming(fetch(`${this.repositories[tagRepository].base}${this.repositories[tagRepository].modules.path}${tagModuleFileName}`))
            if (dryRun) return moduleObject 
            return this.modules[tag] = moduleObject.instance
        } else {
            this.modules[tag] = await import(`${this.repositories[tagRepository].base}${this.repositories[tagRepository].modules.path}${tagModuleFileName}`)
            return dryRun ? : this.modules[tag]
        }
    }},
    _parseDo: {configurable: false, enumerable: false, writable: false, value: async function*(element, doValue) {
        const _parseProcessorFragment = async processorFragment => {
            const [repositoryModuleTag, functionName] = processorFragment.split('.'), notFound = i => 
                console.log(`Processor '${repositoryModuleTag}.${functionName}' is not yet registered, bypassing...`) || i
            if (this.processors[repositoryModuleTag]) return this.processors[repositoryModuleTag][functionName] || notFound
            return await this._getModule(repositoryModuleTag)?.functionName || notFound
        }, _parseDoStatement = async doStatement => {
            const doFragments = doStatement.split('|')
            if (doFragments.length<3) return
            const [eventFragment='@', proxyFragment=((eventFragment='@')?undefined:'@'), processors] = 
                [doFragments.shift()||undefined, doFragments.pop()||undefined, []]
            for (const processorFragment of doFragments) processors.push(_parseProcessorFragment(processorFragment))
            const [eventTargetName='@', eventType='change', eventTarget, eventTargetKey] = [...eventFragment.split('!'), 
                ...(eventTargetName='@'?[element,undefined]:[this.eventTargets[eventTargetName],eventTargetName])]
            const proxy = proxyFragment==='@'?element.b37Dataset:(proxyFragment?this.proxies[proxyFragment]:undefined)
            return [doStatment, eventTarget, eventType, processors, proxy, eventTargetKey]
        }
        for (const doStatement of (doValue || element.getAttribute('b37-do') || '').split(' ')) yield await [..._parseDoStatement(doStatement)]
    }},
    _setupDo: {configurable: false, enumerable: false, writable: false, value: function(element, oldValue=undefined) {
        if (oldValue) {
            for await (const [oldDoStatement, eventTarget, eventType, processors, proxy, eventTargetKey] of this._parseDo(element, oldValue)) {
                if (!eventTarget) continue
                eventTargetKey && eventTarget.removeEventListener(eventType, () => {}, {}, element, oldDoStatement) && !(eventTarget instanceof EventTarget) 
                    && (eventTarget instanceof Object) && !Object.keys(eventTarget._).length && (delete this.eventTargets[eventTargetKey])
                this.eventControllers[element] && this.eventControllers[element][oldDoStatement] && this.eventControllers[element][oldDoStatement].abort()
                delete this.eventControllers[element][oldDoStatement] && !Object.keys(this.eventControllers[element].length) && delete this.eventControllers[element]
            }
        }
        for await (const [doStatement, eventTarget, eventType, processors, proxy] in this._parseDo(element)) {
            if (!eventTarget) continue
            this.eventControllers[element] ||= {}
            this.eventControllers[element][doStatement] = new AbortController()
            eventTarget.addEventListener(eventType, 
                event => this._doHandler(event, processors, element), {signal: this.eventControllers[element][doStatement].signal}, element, doStatement)
        }
    }},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        rootElement || this._enscapulateNative()
        const rootElementTagName = rootElement?.tagName?.toLowerCase()
        rootElement && (this.ids[rootElementTagName] || await this.activateTag(rootElementTagName))
        this.applyTheme(rootElement)
        rootElement?.hasAttribute('b37-do') && this._setupDo(element)
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element?.tagName?.includes('-')) continue
            const tagName = element.tagName.toLowerCase()
            await this.autoload(element)
        }
        observerRoot._b37ElementObserver ||= new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                for (const addedNode of (mutationRecord.addedNodes||[])) if (addedNode?.tagName?.includes('-')) await this.autoload(addedNode)
                if (mutationRecord.attributeName === 'b37-do') this._setupDo(mutationRecord.target, mutationRecord.oldValue)
            }
        })
        observerRoot._b37ElementObserver.observe(domRoot, {subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['b37-do']})
        if (rootElement) return
        this._b37ElementThemeObserver ||= new MutationObserver(mutationList => {
            for (const mutationRecord of mutationList) mutationRecord.attributeName === 'b37-theme' || this.applyTheme(undefined, true)
        })
        this._b37ElementThemeObserver.observe(document.body, {subtree: false, childList: false, attributes: true, attributeFilter: ['b37-theme']})
    }},
    applyTheme: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined, recurse=false) {
        const themeTag = (rootElement||document.body).getAttribute('b37-theme'),
            [themeName=(this.appliedTheme||'theme'), themeSheet='index'] = themeTag ? themeTag.split('-') : []
        if (!this.themes[themeName]) return
        this.appliedTheme = themeName
        const domRoot = rootElement ? rootElement.shadowRoot : document, themeSheetURL = `${this.themes[this.themeName]}${themeSheet}.css`,
            themeSheetElement = domRoot.querySelector(`${rootElement?'style':'link'}[b37-theme="${themeTag}"]`)
            || (rootElement?domRoot.querySelectorAll('style')[0]:domRoot.head).insertAdjacentElement(`${rootElement?'after':'before'}end`,
                document.createElement(rootElement?'style':'link'))
        themeSheetElement.setAttribute('b37-theme', themeTag)
        rootElement || themeSheetElement.setAttribute('rel', 'stylesheet') || themeSheetElement.setAttribute('href', themeSheetURL)
        rootElement && (themeSheetElement.textContent = `@import "${themeSheetURL}";`)
        if (!recurse) return
        const domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName']
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element.tagName.includes('-')) continue
            this.ids[element.tagName.toLowerCase()] && this.applyTheme(element, true)
        }
    }},
    getInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagId='HTMLElement') {
        const inheritance = [tagId]
        while (tagId && this.extends[tagId] && !this._isNative(tagId)) {
            inheritance.push(this.extends[tagId])
            tagId = this.extends[tagId]
        }
        return inheritance
    }},
    sortByInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagIdList) {
        return Array.from(new Set(tagIdList)).filter(t => this.extends[t]).sort((a, b) => 
            ((this.extends[a] === b) && -1) || ((this.extends[b] === a) && 1) || this.getInheritance(b).indexOf(a))
            .map((v, i, a) => (i === a.length-1) ? [v, this.extends[v]] : v).flat()
    }},
    copyAttributes: {configurable: false, enumerable: true, writable: false, value: function(source, target, keep=[], autoKeepB37=false) {
        for (const a in source.getAttributeNames()) {
            if (!keep.includes(a) && !((autoKeepB37) && a.startsWith('b37-'))) continue
            const aValue = source.getAttribute(a)
            (aValue && target.setAttribute(a, aValue)) || (aValue === '' && target.toggleAttribute(a, true))
        }
    }},
    stackTemplates: {configurable: false, enumerable: true, writable: false, value: function(tagId, templateInnerHTML=undefined) {
        const template = document.createElement('template')
        template.innerHTML = templateInnerHTML || this.templates[tagId]
        for (const t of template.content.querySelectorAll('template[id]')) {
            const idAttr = t.getAttribute('id'), tId = idAttr.match(/^[a-z0-9]+-[a-z0-9]+/) ? this.getTagId(idAttr) : idAttr,
                tNode = document.createElement('template')
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
    stackStyles: {configurable: false, enumerable: true, writable: false, value: function(tagId) {
        return `/** core system styles */\n\n b37-slot { display: none; } \n\n\n` + 
            this.getInheritance(tagId).reverse().filter(tId => !this._isNative(tId)).map(tId => `/** ${tId} styles */\n\n` + this.styles[tId]).join("\n\n\n")
    }},
    getTagId: {configurable: false, enumerable: true, writable: false, value: function(tagName) {
        if (this.ids[tagName]) return this.ids[tagName]
        const [tagRepository, tagComponent] = tagName.split('-', 2).map(t => t.toLowerCase())
        return (this.repositories[tagRepository])
            ? (new URL(`${this.repositories[tagRepository].base}${this.repositories[tagRepository].elements.path}${tagComponent}.${this.repositories[tagRepository].elements.suffix}`, document.location)).href
            : (new URL(`${('./'+tagRepository+'/')}${tagComponent}.html`, document.location)).href
    }},
    loadTagAssetsFromId: {configurable: false, enumerable: true, writable: false, value: async function(tagId, forceReload=false) {
        if (!forceReload && this.files[tagId]) return
        this.files[tagId] = await fetch(tagId).then(r => r.text())
        this.styles[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<style>')+7, this.files[tagId].indexOf('</style>')).trim()
        this.templates[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<template>')+10, this.files[tagId].indexOf('</template>')).trim()
        this.scripts[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<script>')+8, this.files[tagId].indexOf('</script>')).trim()
        const extendsRegExp = /class\s+extends\s+`(?<extends>.+)`\s+\{/,
            extendsClassAliasGroups = this.scripts[tagId].match(extendsRegExp)?.groups, extendsClassAlias = extendsClassAliasGroups?.extends
        let extendsClassId = extendsClassAlias?.match(/^[a-z0-9]+-[a-z0-9]+$/) ? this.getTagId(extendsClassAlias) : extendsClassAlias
        if (extendsClassId) {
            this._isNative(extendsClassId) || (extendsClassId = (new URL(extendsClassId, document.location)).href)
            this.extends[tagId] = extendsClassId
            this.files[extendsClassId] || this._isNative(extendsClassId) || await this.loadTagAssetsFromId(extendsClassId)
        }
        let sanitizedScript = this.scripts[tagId].replace(extendsRegExp, `class extends Element.constructors['${extendsClassId}'] {`)
        this.classes[tagId] = Function('Element', 'return ' + sanitizedScript)(this)
        const Element = this
        this.classes[tagId].b37TagId = tagId
        this.constructors[tagId] = class extends this.classes[tagId] {constructor() {super()}}
    }},
    activateTag: {configurable: false, enumerable: true, writable: false, value: async function(tagName, forceReload=false) {
        if ((!forceReload && this.ids[tagName]) || !tagName.includes('-')) return
        const tagId = this.getTagId(tagName)
        this.ids[tagName] = tagId
        this.tagNames[tagId] = tagName
        await this.loadTagAssetsFromId(tagId, forceReload)
        const baseTagName = this.getInheritance(tagId).pop() || 'HTMLElement'
        globalThis.customElements.define(tagName, this.constructors[tagId],
            ((baseTagName !== 'HTMLElement' && this._isNative(baseTagName)) ? {extends: baseTagName} : undefined))
    }},
    _enscapulateNative: {configurable: false, enumerable: false, writable: false, value: function() {
        for (const nativeClassName of Reflect.ownKeys(globalThis)) {
            if (!this._isNative(nativeClassName) || (this.classes[nativeClassName] && this.constructors[nativeClassName])) continue
            this.classes[nativeClassName] ||= ((nativeClassName === 'HTMLImageElement' && globalThis['Image'])
                || (nativeClassName === 'HTMLAudioElement' && globalThis['Audio']) || globalThis[nativeClassName])
            this.constructors[nativeClassName] ||= this._base(this.classes[nativeClassName])
        }
    }},
    _dispatchPropertyEvent: {configurable: false, enumerable: false, writable: false, value: function(element, eventNamePrefix, property, eventDetail) {
        eventDetail = {detail: {property: property, ...eventDetail}}
        element.dispatchEvent(new CustomEvent(eventNamePrefix, eventDetail))
        element.dispatchEvent(new CustomEvent(`${eventNamePrefix}-${property}`, eventDetail))
    }},
    _base: {configurable: false, enumerable: false, writable: false, value: function(baseClass=globalThis.HTMLElement) {
        return class extends baseClass {
            constructor() {
                super()
                const $this = this, addSrcToDocument = (querySelectorTemplate, src, tagName, srcAttrName, appendTo, otherAttrs=[]) => {
                    if (document.querySelector(querySelectorTemplate.replace(/\$B37/g, src))) return
                    const tag = appendTo.appendChild(document.createElement(tagName))
                    tag.setAttribute(srcAttrName, src)
                    for (const a of otherAttrs) tag.setAttribute(...a)
                }
                for (const src of ($this.constructor.b37Js || [])) addSrcToDocument('script[src="$B37"]', src, 'script', 'src', document.body)
                for (const src of ($this.constructor.b37Mjs || [])) addSrcToDocument('script[src="$B37"]', src, 'script', 'src', document.body, [['type', 'module']])
                for (const src of ($this.constructor.b37Css || [])) addSrcToDocument('link[rel="stylesheet"][href="$B37"]', src, 'link', 'href', document.head, [['rel', 'stylesheet']])
                $this.constructor.b37WasmModules ||= {}
                for (const moduleName in $this.constructor.b37Wasm) {
                    if ($this.constructor.b37WasmModules[moduleName]) continue
                    $this.constructor.b37WasmModules[moduleName] = true
                    WebAssembly.instantiateStreaming(fetch($this.constructor.b37Wasm[moduleName].src),
                        $this.constructor.b37Wasm[moduleName].importObject).then(importResult => 
                            $this.constructor.b37WasmModules[moduleName] = importResult
                    ).catch(e => $this.constructor.b37WasmModules[moduleName] = {})
                }
                if (!$this.constructor.tagPrefixes) for (r in ($this.constructor.repositories || [])) $this.constructor.tagPrefixes[r] = crypto.randomUUID().replace(/\-/g, '')
                $this.constructor.b37Constraints ||= {}
                $this.constructor.b37Sanitizers ||= {}
                $this.b37LocalConstraints ||= {}
                $this.b37LocalSanitizers ||= {}
                $this.b37QueuedAttributes = {}
                $this.b37Dataset = new Proxy($this.dataset, {
                    has(target, property) {
                        if (!'@#.>'.includes(property[0])) return property.trim() in target 
                            || !!$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.trim()}"]:not(b37-slot)`)
                        return ((property[0] === '@') && $this.hasAttribute(property.slice(1)))
                            || ((property[0] === '#') && property.slice(1) in $this)
                            || ((property[0] === '.') && !!$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && !!$this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`))
                    },
                    get(target, property, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (property in target) return target[property]
                            const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]:not(b37-slot)`)
                            return propertyRenderer ? Object.assign({}, (propertyRenderer.b37Dataset || {})) : undefined
                        }
                        return ((property[0] === '@') && $this.getAttribute(property.slice(1)))
                            || ((property[0] === '#') && $this[property.slice(1)])
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`))
                    },
                    set(target, property, value, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (value && (target[property] === value)) return true
                            let sanitized = false, sanitizedDetails = '', withinConstraint = true, withinConstraintDetails = '',
                                returnValue = undefined
                            const oldValue = target[property], givenValue = value, sanitizer = $this.b37LocalSanitizers[property] 
                                || $this.constructor.b37Sanitizers[property],constraint = $this.b37LocalConstraints[property] 
                                || $this.constructor.b37Constraints[property]
                            typeof sanitizer === 'function' && ([value, sanitized, sanitizedDetails] = sanitizer(value))
                            typeof constraint === 'function' && ([withinConstraint, withinConstraintDetails] = constraint(value))
                            value ?? (returnValue = this.deleteProperty(target, property))
                            if (value && typeof value === 'object') {
                                let propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]`)
                                if (propertyRenderer) {
                                    if (propertyRenderer.tagName.toLowerCase() === 'b37-slot') {
                                        const useTagRepository = b37slot.getAttribute('b37-repo'),
                                            useTagSuffix = b37slot.getAttribute('b37-suffix')
                                        if (useTagRepository && useTagSuffix && $this.constructor.tagPrefixes[useTagRepository]) {
                                            const useTag = `${$this.constructor.tagPrefixes[useTagRepository]}-${useTagSuffix}`, b37slot = propertyRenderer
                                            propertyRenderer = document.createElement(useTag)
                                            Element.copyAttributes(b37slot, propertyRenderer, (b37slot.getAttribute('b37-keep') || '').split(' ').filter(a => !!a), true)
                                            b37slot.replaceWith(propertyRenderer)
                                        } else {
                                            throw new TypeError(`Either b37-repo, b37-suffix are not set, or are set and do not match a repository for element class with id ${this.constructor.b37TagId} property ${property}`)
                                            returnValue = false
                                        }
                                    }
                                    for (const k in propertyRenderer.b37Dataset) (k in value) || delete propertyRenderer.b37Dataset[k]
                                    for (const k in value) if (propertyRenderer.b37Dataset[k] !== value[k]) propertyRenderer.b37Dataset[k] = value[k]
                                    returnValue = true
                                } else {
                                    throw new TypeError(`No sub-element found in the shadowRoot with a b37-prop equal to ${property} for this instance of element class ${this.constructor.b37TagId}`)
                                    returnValue = false
                                }
                            } else {
                                returnValue = !!(target[property] = value)
                            }
                            const eventDetail = {givenValue: givenValue, value: value, oldValue: oldValue, sanitized: sanitized,
                                sanitizedDetails: sanitizedDetails,withinConstraint: withinConstraint, withinConstraintDetails: withinConstraintDetails}
                            Element._dispatchPropertyEvent('change', property, eventDetail)
                            const validator = $this.b37LocalValidator || $this.constructor.b37Validator
                            if (typeof validator == 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                Object.assign(eventDetail, {handler: 'set', isValid: isValid, validatorDetails: validatorDetails})
                                Element._dispatchPropertyEvent('b37DatasetValidation', property, eventDetail)
                            }
                            return returnValue
                        }
                        Element._dispatchPropertyEvent('change', property, {value: value})
                        return ((property[0] === '@') && $this.setAttribute(property.slice(1), value))
                            || ((property[0] === '#') && ($this[property.slice(1)] = value))
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`))
                    }, 
                    deleteProperty(target, property) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            let returnValue, oldValue = target[property]
                            if (property in target) {
                                returnValue = delete target[property]
                            } else {
                                const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]:not(b37-slot)`)
                                if (propertyRenderer) {
                                    const b37slot = document.createElement('b37-slot')
                                    Element.copyAttributes(propertyRenderer, b37slot, (propertyRenderer.getAttribute('b37-keep') || '').split(' ').filter(a => !!a), true)
                                    propertyElement.replaceWith(b37slot)
                                }
                                returnValue = true
                            }
                            Element._dispatchPropertyEvent('b37DatasetDeleteProperty', property, {oldValue: oldValue})
                            const validator = $this.b37LocalValidator || $this.constructor.b37Validator
                            if (typeof validator === 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                Element._dispatchPropertyEvent('b37DatasetValidation', property, {handler: 'deleteProperty', property: property,
                                    oldValue: oldValue, isValid: isValid, validatorDetails: validatorDetails})
                            }
                            return returnValue
                        }
                        return ((property[0] === '@') && $this.removeAttribute(property.slice(1)))
                            || ((property[0] === '#') && delete $this[property.slice(1)])
                            || ((property[0] === '.') && !$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`)?.remove())
                            || ((property[0] === '>') && !$this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`)?.remove())
                    }
                })
                $this.shadowRoot || $this.attachShadow({mode: 'open'})
                $this.shadowRoot.textContent = ''
                $this.shadowRoot.appendChild(document.createElement('style')).textContent = Element.stackStyles(this.constructor.b37TagId)
                const templateNode = document.createElement('template')
                templateNode.innerHTML = Element.stackTemplates(this.constructor.b37TagId)
                $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
            }
            static get observedAttributes() { return [] }
            attributeChangedCallback(attrName, oldVal, newVal) { this[attrName] = newVal }
            b37ProcessQueuedAttributes() {
                const $this = this
                for (const k in $this.b37QueuedAttributes) {
                    if (typeof $this.b37QueuedAttributes[k]?.requires === 'function' && $this.b37QueuedAttributes[k].requires() === false) continue
                    if ($this.b37QueuedAttributes[k].attribute && $this.b37QueuedAttributes[k].value) {
                        $this.setAttribute($this.b37QueuedAttributes[k].attribute, $this.b37QueuedAttributes[k].value)
                        typeof $this.b37QueuedAttributes[k].callback === 'function' && $this.b37QueuedAttributes[k].callback()
                    }
                    delete $this.b37QueuedAttributes[k]
                }
                if (Object.keys($this.b37QueuedAttributes).length === 0) globalThis.clearInterval($this.__b37QueuedAttributeInterval)
            }
            b37AddQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.b37QueuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__b37QueuedAttributeInterval ||= globalThis.setInterval(() => $this.b37ProcessQueuedAttributes(), 1000)
            }
        }
    }}
})
export { Element }