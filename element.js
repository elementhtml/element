const ElementHTML = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'},
    env: {configurable: false, enumerable: true, writable: false, value: Object.defineProperties({}, {
        auth: {configurable: false, enumerable: true, writable: false, value: {}},
        globalThis: {configurable: false, enumerable: true, writable: false, value: globalThis},
        options: {configurable: false, enumerable: true, writable: false, value: {}}
    })},
    repos: {configurable: false, enumerable: true, writable: false, value: {}},
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
    processors: {configurable: false, enumerable: true, writable: false, value: Object.defineProperties({}, {
        '$': {configurable: false, enumerable: true, writable: false, value: input => input}, 
        '404': {configurable: false, enumerable: true, writable: false, value: input => {
            return (this.env.options.verbose && console.log(`Processor '${repositoryModuleTag}.${functionName}' is not yet registered, bypassing...`)) || input
        }}
    })},
    layouts: {configurable: false, enumerable: true, writable: false, value: {}},
    themes: {configurable: false, enumerable: true, writable: false, value: {}},
    appliedTheme: {configurable: false, enumerable: true, writable: true, value: undefined},
    decorators: {configurable: false, enumerable: true, writable: false, value: Object.defineProperties({}, {
        '{': {configurable: false, enumerable: true, writable: false, value: input => {
            if (input && typeof input === 'string') {
                try { return JSON.parse(input) } catch(e) { return input }
            } else { return input }
        }},
        '[': {configurable: false, enumerable: true, writable: false, value: (input, key) => ({[key]: input})},
        '~': {configurable: false, enumerable: true, writable: false, value: (input, ...keys) => Object.assign({}, ...keys.map(k => ({[k]: input[k]})))},
        ']': {configurable: false, enumerable: true, writable: false, value: (input, key) => input[key]},
        '}': {configurable: false, enumerable: true, writable: false, value: input => {
            if (input && typeof input !== 'string') {
                 try { return JSON.stringify(input) } catch(e) { return String(input) }
             } else { return input }
        }}
    })},
    _EHObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _EHThemeObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _eventTargets: {configurable: false, enumerable: false, writable: false, value: {}},
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && (tagName == 'Image' || tagName == 'Audio' || (tagName.startsWith('HTML') && tagName.endsWith('Element')))
    }},
    _doHandler: {configurable: false, enumerable: false, writable: false, value: async function(event, processors, element) {
        let processorData = {}
        const parseElementsource = (source, container) => {
            if (typeof source === 'object') {
                Object.assign(processorData, source)
            } else if (typeof source === 'string' && container && (typeof container === 'object') && source in container) {
                const parseTest = parseElementsource(container[source])
                parseTest && typeof parseTest === 'object' && Object.assign(processorData, parseTest)
            } else if (typeof source === 'string' && source.startsWith('`') && source.endsWith('`') ) {
                try {
                    const parseTest = JSON.parse(source.slice(1,-1))
                    parseTest && typeof parseTest === 'object' && Object.assign(processorData, parseTest)
                } catch(e) {}
            }
        }
        element.getAttribute(`eh-source`) && parseElementsource(element.getAttribute('eh-source'), element.ElementDataset)
        element.getAttribute(`eh-source-${event.type}`) && parseElementsource(element.getAttribute(`eh-source-${event.type}`), element.ElementDataset)
        if (event.formData || event.detail || event.data) {
            Object.assign(processorData, (event.formData instanceof Object && event.formData) || (event.detail instanceof Object && event.detail)
                || (event.data instanceof Object && event.data) || {})
        }
        if (!(processorData && typeof processorData === 'object')) processorData = {}
        for (const processor of processors) {
            if (typeof this.processors[processor] === 'function') {
                const processorOutput = await this.processors[processor]((processorData && processorData==='object')?processorData:{}, event, element, this.env)
                processorOutput && typeof processorOutput === 'object' && Object.assign(processorData, processorOutput)
            }
        }
        if (processorData && typeof processorData === 'object' && 'ElementReduce' in processorData) {
            processorData = (processorData.ElementReduce instanceof Function) ? processorData.ElementReduce(processorData) : processorData.ElementReduce
        }
        if (processorData && typeof processorData === 'object' && processorData.ElementSink && typeof processorData.ElementSink === 'string') {
            const ElementSink = processorData.ElementSink
            delete processorData.ElementSink
            element[ElementSink] = (element[ElementSink] && typeof element[ElementSink] === 'object') ? Object.assign(element[ElementSink], processorData) : processorData
        } else if (event.ElementSink && typeof event.ElementSink === 'string') {
            element.ElementSink[event.ElementSink] = (element.ElementSink[event.ElementSink] && typeof element.ElementSink[event.ElementSink] === 'object')
                ? Object.assign(element.ElementSink[event.ElementSink], processorData) : processorData
        } else if (event.ElementSink && typeof event.ElementSink === 'object') {
            event.ElementSink = (event.ElementSink && typeof event.ElementSink === 'object')
                ? Object.assign(event.ElementSink, processorData) : processorData
        } else if (element.getAttribute(`eh-sink-${event.type}`)) {
            const ElementSink = element.getAttribute(`eh-sink-${event.type}`)
            element.ElementSink[ElementSink] = (element.ElementSink[ElementSink] && typeof element.EHSink[EHSink] === 'object') 
                ? Object.assign(element.EHSink[EHSink], processorData) : processorData
        } else if (element.getAttribute('eh-sink')) {
            const EHSink = element.getAttribute('eh-sink')
            element.EHSink[EHSink] = (element.EHSink[EHSink] && typeof element.EHSink[EHSink] === 'object') 
                ? Object.assign(element.EHSink[EHSink], processorData) : processorData
        } else if (processorData && typeof processorData === 'object') {
            Object.assign(element.EHDataset, processorData)
        }
   }},
    _getModule: {configurable: false, enumerable: false, writable: false, value: async function(tag, dryRun=false) {
        if (this.modules[tag]) return this.modules[tag]
        if (!tag.includes(':')) return
        const [tagRepository, tagModule] = tag.split(':')
        if (!this.repos[tagRepository]) return
        const fileNameSuffix = tagModule.includes('.') ? tagModule.split('.', 2)[1] : this.repos[tagRepository].modules.suffix || 'wasm',
            tagModuleFileName = tagModule.includes('.') ? tagModule : `${tagModule}.${fileNameSuffix}`
        if (fileNameSuffix === 'wasm') {
            const moduleObject = await WebAssembly.instantiateStreaming(fetch(`${this.repos[tagRepository].base}${this.repos[tagRepository].modules.path}${tagModuleFileName}`))
            if (dryRun) return moduleObject 
            return this.modules[tag] = moduleObject.instance
        } else {
            const importedModule = await import(`${this.repos[tagRepository].base}${this.repos[tagRepository].modules.path}${tagModuleFileName}`)
            if (dryRun) return importedModule
            return this.modules[tag] = importedModule
        }
    }},
    _parseDo: {configurable: false, enumerable: false, writable: false, value: async function*(element, doValue) {
        const _parseProcessorFragment = async processorFragment => {
            const [repositoryModuleTag, functionSignature] = processorFragment.split('.'), [functionName, functionDecoratorsSignature] = functionSignature.split('@')
            let coreFunction, decoratedFunction = coreFunction
            if (this.processors[repositoryModuleTag]) coreFunction = this.processors[repositoryModuleTag][functionName] || this.processors['404']
            coreFunction ||= await this._getModule(repositoryModuleTag)?.functionName || this.processors['404']
            if (functionDecoratorsSignature) {
                const [preDecoratorsSignature, postDecoratorsSignature] = functionDecoratorsSignature.split('$'), preDecorators = [], postDecorators = []
                for (const [s, d] of [[preDecoratorsSignature, preDecorators], [postDecoratorsSignature, postDecorators]]) {
                    for (const decoratorFragment in s.split(';')) {
                        const [decoratorKey, decoratorArgs=''] = decoratorFragment.split('=')
                        if (typeof this.decorators[decoratorKey] === 'function') d.push(input => this.decorators[decoratorKey](input, ...decoratorArgs.split(',')))
                    }
                }
                decoratedFunction = (input) => {
                    for (const fd of preDecorators) input = fd(input)
                    input = coreFunction(input)
                    for (const fd of postDecorators) input = fd(input)
                    return input
                }
            }
            return decoratedFunction
        }, _parseDoStatement = async doStatement => {
            const doFragments = doStatement.split('|')
            if (doFragments.length<3) return
            const [eventFragment='@', proxyFragment=((eventFragment='@')?undefined:'@'), processors] = 
                [doFragments.shift()||undefined, doFragments.pop()||undefined, []]
            for (const processorFragment of doFragments) processors.push(_parseProcessorFragment(processorFragment))
            const [eventTargetName='@', eventType='change', eventTarget, eventTargetKey] = [...eventFragment.split('!'), 
                ...(eventTargetName='@'?[element,undefined]:[this.eventTargets[eventTargetName],eventTargetName])], 
                proxy = proxyFragment==='@'?element.EHDataset:(proxyFragment?this.proxies[proxyFragment]:undefined)
            return [doStatment, eventTarget, eventType, processors, proxy, eventTargetKey]
        }
        for (const doStatement of (doValue || element.getAttribute('eh-do') || '').split(' ')) yield await [..._parseDoStatement(doStatement)]
    }},
    _setupDo: {configurable: false, enumerable: false, writable: false, value: async function(element, oldValue=undefined) {
        if (oldValue) {
            for await (const [oldDoStatement, eventTarget, eventType, processors, proxy, eventTargetKey] of this._parseDo(element, oldValue)) {
                if (!eventTarget) continue
                eventTargetKey && eventTarget.removeEventListener(eventType, () => {}, {}, element, oldDoStatement) && !(eventTarget instanceof EventTarget) 
                    && (eventTarget instanceof Object) && !Object.keys(eventTarget._).length && (delete this.eventTargets[eventTargetKey])
                this.eventControllers[element] && this.eventControllers[element][oldDoStatement] && this.eventControllers[element][oldDoStatement].abort()
                delete this.eventControllers[element][oldDoStatement] && !Object.keys(this.eventControllers[element].length) && delete this.eventControllers[element]
            }
        }
        for await (const [doStatement, eventTarget, eventType, processors, proxy] of this._parseDo(element)) {
            if (!eventTarget) continue
            this.eventControllers[element] ||= {}
            this.eventControllers[element][doStatement] = new AbortController()
            eventTarget.addEventListener(eventType, 
                async event => await this._doHandler(event, processors, element), {signal: this.eventControllers[element][doStatement].signal}, element, doStatement)
        }
    }},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        rootElement || this._enscapulateNative()
        const rootElementTagName = rootElement?.tagName?.toLowerCase()
        rootElement && (this.ids[rootElementTagName] || await this.activateTag(rootElementTagName))
        this.applyTheme(rootElement)
        rootElement?.hasAttribute('eh-do') && await this._setupDo(element)
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element?.tagName?.includes('-')) continue
            const tagName = element.tagName.toLowerCase()
            await this.autoload(element)
        }
        observerRoot._EHElementObserver ||= new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                for (const addedNode of (mutationRecord.addedNodes||[])) if (addedNode?.tagName?.includes('-')) await this.autoload(addedNode)
                if (mutationRecord.attributeName === 'eh-do') await this._setupDo(mutationRecord.target, mutationRecord.oldValue)
            }
        })
        observerRoot._EHElementObserver.observe(domRoot, {subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['eh-do']})
        if (rootElement) return
        this._EHElementThemeObserver ||= new MutationObserver(mutationList => {
            for (const mutationRecord of mutationList) mutationRecord.attributeName === 'eh-theme' || this.applyTheme(undefined, true)
        })
        this._EHElementThemeObserver.observe(document.body, {subtree: false, childList: false, attributes: true, attributeFilter: ['eh-theme']})
    }},
    applyTheme: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined, recurse=false) {
        const themeTag = (rootElement||document.body).getAttribute('eh-theme'),
            [themeName=(this.appliedTheme||'theme'), themeSheet='index'] = themeTag ? themeTag.split('-') : []
        if (!this.themes[themeName]) return
        this.appliedTheme = themeName
        const domRoot = rootElement ? rootElement.shadowRoot : document, themeSheetURL = `${this.themes[this.themeName]}${themeSheet}.css`,
            themeSheetElement = domRoot.querySelector(`${rootElement?'style':'link'}[eh-theme="${themeTag}"]`)
            || (rootElement?domRoot.querySelectorAll('style')[0]:domRoot.head).insertAdjacentElement(`${rootElement?'after':'before'}end`,
                document.createElement(rootElement?'style':'link'))
        themeSheetElement.setAttribute('eh-theme', themeTag)
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
    copyAttributes: {configurable: false, enumerable: true, writable: false, value: function(source, target, keep=[], autoKeepEH=false) {
        for (const a in source.getAttributeNames()) {
            if (!keep.includes(a) && !((autoKeepEH) && a.startsWith('eh-'))) continue
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
        return `/** core system styles */\n\n eh-slot { display: none; } \n\n\n` + 
            this.getInheritance(tagId).reverse().filter(tId => !this._isNative(tId)).map(tId => `/** ${tId} styles */\n\n` + this.styles[tId]).join("\n\n\n")
    }},
    getTagId: {configurable: false, enumerable: true, writable: false, value: function(tagName) {
        if (this.ids[tagName]) return this.ids[tagName]
        const [tagRepository, tagComponent] = tagName.split('-', 2).map(t => t.toLowerCase())
        return (this.repos[tagRepository])
            ? (new URL(`${this.repos[tagRepository].base}${this.repos[tagRepository].elements.path}${tagComponent}.${this.repos[tagRepository].elements.suffix}`, document.location)).href
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
        this.classes[tagId].EHTagId = tagId
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
                    if (document.querySelector(querySelectorTemplate.replace(/\$EH/g, src))) return
                    const tag = appendTo.appendChild(document.createElement(tagName))
                    tag.setAttribute(srcAttrName, src)
                    for (const a of otherAttrs) tag.setAttribute(...a)
                }
                for (const src of ($this.constructor.EHJs || [])) addSrcToDocument('script[src="$EH"]', src, 'script', 'src', document.body)
                for (const src of ($this.constructor.EHMjs || [])) addSrcToDocument('script[src="$EH"]', src, 'script', 'src', document.body, [['type', 'module']])
                for (const src of ($this.constructor.EHCss || [])) addSrcToDocument('link[rel="stylesheet"][href="$EH"]', src, 'link', 'href', document.head, [['rel', 'stylesheet']])
                $this.constructor.EHWasmModules ||= {}
                for (const moduleName in $this.constructor.EHWasm) {
                    if ($this.constructor.EHWasmModules[moduleName]) continue
                    $this.constructor.EHWasmModules[moduleName] = true
                    WebAssembly.instantiateStreaming(fetch($this.constructor.EHWasm[moduleName].src),
                        $this.constructor.EHWasm[moduleName].importObject).then(importResult => 
                            $this.constructor.EHWasmModules[moduleName] = importResult
                    ).catch(e => $this.constructor.EHWasmModules[moduleName] = {})
                }
                if (!$this.constructor.tagPrefixes) for (r in ($this.constructor.repos || [])) $this.constructor.tagPrefixes[r] = crypto.randomUUID().replace(/\-/g, '')
                $this.constructor.EHConstraints ||= {}
                $this.constructor.EHSanitizers ||= {}
                $this.EHLocalConstraints ||= {}
                $this.EHLocalSanitizers ||= {}
                $this.EHQueuedAttributes = {}
                $this.EHDataset = new Proxy($this.dataset, {
                    has(target, property) {
                        if (!'@#.>'.includes(property[0])) return property.trim() in target 
                            || !!$this.shadowRoot.querySelector(`:scope > [eh-prop="${property.trim()}"]:not(eh-slot)`)
                        return ((property[0] === '@') && $this.hasAttribute(property.slice(1)))
                            || ((property[0] === '#') && property.slice(1) in $this)
                            || ((property[0] === '.') && !!$this.shadowRoot.querySelector(`:scope > [eh-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && !!$this.shadowRoot.querySelector(`:scope > eh-slot[eh-prop="${property.slice(1)}"]`))
                    },
                    get(target, property, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (property in target) return target[property]
                            const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [eh-prop="${property}"]:not(eh-slot)`)
                            return propertyRenderer ? Object.assign({}, (propertyRenderer.EHDataset || {})) : undefined
                        }
                        return ((property[0] === '@') && $this.getAttribute(property.slice(1)))
                            || ((property[0] === '#') && $this[property.slice(1)])
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [eh-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > eh-slot[eh-prop="${property.slice(1)}"]`))
                    },
                    set(target, property, value, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (value && (target[property] === value)) return true
                            let sanitized = false, sanitizedDetails = '', withinConstraint = true, withinConstraintDetails = '',
                                returnValue = undefined
                            const oldValue = target[property], givenValue = value, sanitizer = $this.EHLocalSanitizers[property] 
                                || $this.constructor.EHSanitizers[property],constraint = $this.EHLocalConstraints[property] 
                                || $this.constructor.EHConstraints[property]
                            typeof sanitizer === 'function' && ([value, sanitized, sanitizedDetails] = sanitizer(value))
                            typeof constraint === 'function' && ([withinConstraint, withinConstraintDetails] = constraint(value))
                            value ?? (returnValue = this.deleteProperty(target, property))
                            if (value && typeof value === 'object') {
                                let propertyRenderer = $this.shadowRoot.querySelector(`:scope > [eh-prop="${property}"]`)
                                if (propertyRenderer) {
                                    if (propertyRenderer.tagName.toLowerCase() === 'eh-slot') {
                                        const useTagRepository = EHslot.getAttribute('eh-repo'),
                                            useTagSuffix = EHslot.getAttribute('eh-suffix')
                                        if (useTagRepository && useTagSuffix && $this.constructor.tagPrefixes[useTagRepository]) {
                                            const useTag = `${$this.constructor.tagPrefixes[useTagRepository]}-${useTagSuffix}`, EHslot = propertyRenderer
                                            propertyRenderer = document.createElement(useTag)
                                            Element.copyAttributes(EHslot, propertyRenderer, (EHslot.getAttribute('eh-keep') || '').split(' ').filter(a => !!a), true)
                                            EHslot.replaceWith(propertyRenderer)
                                        } else {
                                            throw new TypeError(`Either eh-repo, eh-suffix are not set, or are set and do not match a repository for element class with id ${this.constructor.EHTagId} property ${property}`)
                                            returnValue = false
                                        }
                                    }
                                    for (const k in propertyRenderer.EHDataset) (k in value) || delete propertyRenderer.EHDataset[k]
                                    for (const k in value) if (propertyRenderer.EHDataset[k] !== value[k]) propertyRenderer.EHDataset[k] = value[k]
                                    returnValue = true
                                } else {
                                    throw new TypeError(`No sub-element found in the shadowRoot with a eh-prop equal to ${property} for this instance of element class ${this.constructor.EHTagId}`)
                                    returnValue = false
                                }
                            } else {
                                returnValue = !!(target[property] = value)
                            }
                            const eventDetail = {givenValue: givenValue, value: value, oldValue: oldValue, sanitized: sanitized,
                                sanitizedDetails: sanitizedDetails,withinConstraint: withinConstraint, withinConstraintDetails: withinConstraintDetails}
                            Element._dispatchPropertyEvent('change', property, eventDetail)
                            const validator = $this.EHLocalValidator || $this.constructor.EHValidator
                            if (typeof validator == 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.EHDataset))
                                Object.assign(eventDetail, {handler: 'set', isValid: isValid, validatorDetails: validatorDetails})
                                Element._dispatchPropertyEvent('EHDatasetValidation', property, eventDetail)
                            }
                            return returnValue
                        }
                        Element._dispatchPropertyEvent('change', property, {value: value})
                        return ((property[0] === '@') && $this.setAttribute(property.slice(1), value))
                            || ((property[0] === '#') && ($this[property.slice(1)] = value))
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [eh-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > eh-slot[eh-prop="${property.slice(1)}"]`))
                    }, 
                    deleteProperty(target, property) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            let returnValue, oldValue = target[property]
                            if (property in target) {
                                returnValue = delete target[property]
                            } else {
                                const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [eh-prop="${property}"]:not(eh-slot)`)
                                if (propertyRenderer) {
                                    const EHslot = document.createElement('eh-slot')
                                    Element.copyAttributes(propertyRenderer, EHslot, (propertyRenderer.getAttribute('eh-keep') || '').split(' ').filter(a => !!a), true)
                                    propertyElement.replaceWith(EHslot)
                                }
                                returnValue = true
                            }
                            Element._dispatchPropertyEvent('EHDatasetDeleteProperty', property, {oldValue: oldValue})
                            const validator = $this.EHLocalValidator || $this.constructor.EHValidator
                            if (typeof validator === 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.EHDataset))
                                Element._dispatchPropertyEvent('EHDatasetValidation', property, {handler: 'deleteProperty', property: property,
                                    oldValue: oldValue, isValid: isValid, validatorDetails: validatorDetails})
                            }
                            return returnValue
                        }
                        return ((property[0] === '@') && $this.removeAttribute(property.slice(1)))
                            || ((property[0] === '#') && delete $this[property.slice(1)])
                            || ((property[0] === '.') && !$this.shadowRoot.querySelector(`:scope > [eh-prop="${property.slice(1)}"]`)?.remove())
                            || ((property[0] === '>') && !$this.shadowRoot.querySelector(`:scope > eh-slot[eh-prop="${property.slice(1)}"]`)?.remove())
                    }
                })
                $this.shadowRoot || $this.attachShadow({mode: 'open'})
                $this.shadowRoot.textContent = ''
                $this.shadowRoot.appendChild(document.createElement('style')).textContent = Element.stackStyles(this.constructor.EHTagId)
                const templateNode = document.createElement('template')
                templateNode.innerHTML = Element.stackTemplates(this.constructor.EHTagId)
                $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
            }
            static get observedAttributes() { return [] }
            attributeChangedCallback(attrName, oldVal, newVal) { this[attrName] = newVal }
            EHProcessQueuedAttributes() {
                const $this = this
                for (const k in $this.EHQueuedAttributes) {
                    if (typeof $this.EHQueuedAttributes[k]?.requires === 'function' && $this.EHQueuedAttributes[k].requires() === false) continue
                    if ($this.EHQueuedAttributes[k].attribute && $this.EHQueuedAttributes[k].value) {
                        $this.setAttribute($this.EHQueuedAttributes[k].attribute, $this.EHQueuedAttributes[k].value)
                        typeof $this.EHQueuedAttributes[k].callback === 'function' && $this.EHQueuedAttributes[k].callback()
                    }
                    delete $this.EHQueuedAttributes[k]
                }
                if (Object.keys($this.EHQueuedAttributes).length === 0) globalThis.clearInterval($this.__EHQueuedAttributeInterval)
            }
            EHAddQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.EHQueuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__EHQueuedAttributeInterval ||= globalThis.setInterval(() => $this.EHProcessQueuedAttributes(), 1000)
            }
        }
    }}
})
Object.defineProperty(Element.env, 'Element', {configurable: false, enumerable: true, writable: false, value: Element})
Object.defineProperty(Element, 'eventTargets', {configurable: false, enumerable: true, writable: false, value: new Proxy(Element._eventTargets, {
    get: (target, prop, receiver) => {
        if  (!target[prop] && !target[prop] instanceof Object && !target[prop] instanceof EventTarget) {
            target[prop] = {_: {},
                addEventListener: (type, listener, options, element, doStatement) => {
                    if (!element || !doStatement) return
                    target[prop]._[element] ||= {}
                    target[prop]._[element][doStatement] ||= [type, listener, options]
                },
                removeEventListener: (type, listener, options, element, doStatement) => {
                    if (!element || !doStatement) return
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
})})
export { ElementHTML }