const Element = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'},
    env: {configurable: false, enumerable: true, writable: false, value: Object.defineProperties({}, {
        auth: {configurable: false, enumerable: true, writable: false, value: {}},
        globalThis: {configurable: false, enumerable: true, writable: false, value: globalThis},
        options: {configurable: false, enumerable: true, writable: false, value: Object.defineProperties({}, {
            defaultPages: {configurable: false, enumerable: true, writable: false, value: {content: 'home', layout: 'default', nav: 'main'}}
        })}
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
    _proxies: {configurable: false, enumerable: false, writable: false, value: {}},
    proxies: {configurable: false, enumerable: true, writable: false, value: {}},
    setProxy: {configurable: false, enumerable: true, writable: false, value: function(name, handler, target={}) {
        return (this.proxies[name] = new Proxy((this._proxies[name] = target), handler))
    },
    codecs: {configurable: false, enumerable: false, writable: false, value: Object.defineProperties({}, {
        md: {configurable: false, enumerable: true, writable: false, value: async (raw) => {
            console.log('line 27', raw)
            const parsed = {}
            if (!raw && typeof raw !== 'string') return parsed
            for (const chunk of raw.split('***`#!Element')) {
                let [chunkhead='main', body=''] = chunk.split('`***', 2), 
                    [partName, metaRaw] = chunkhead.split('{', 2), meta = {}
                if (metaRaw && metaRaw.endsWith('}')) try { meta = JSON.parse(`{${metaRaw}`) } catch(e) {}
                partName = partName.trim()
                body = body.trim()
                console.log('line 36', partName, meta, body)

            }
        }}
    })},
    _routerData: {configurable: false, enumerable: false, writable: false, value: {}},
    _routerHandlerDefault: {configurable: false, enumerable: false, writable: false, value: async function(mode, rootElement=undefined, repoName=undefined) {
        const repo = this.repos[repoName] || {}
        this._routerData['/'] ||= {[mode]: {}, index: {}}
        this._routerData['/'].index[document.location.href] ||= document.location.href.replace(document.head.getElementsByTagName('base')[0].href, '').split('.').slice(0, -1).join('.')
        const page = this._routerData['/'].index[document.location.href], contentFormat = repo[mode]?.suffix || this.env.options.defaultSuffixes[mode]
        this._routerData['/'][mode][page] ||= {
            url: `${repo.base||'./'}${repo[mode]?.path||`${mode}/`}${page||repo[mode]?.index||this.env.options.defaultPages[mode]}.${contentFormat}`
        }            
        this._routerData['/'][mode][page].raw ||= await fetch(this._routerData['/'][mode][page].url).then(r => r.text())
        this._routerData['/'][mode][page].parsed ||= await this.contentParsers[contentFormat](this._routerData['/'][mode][page].raw)
       return {[page]: this._routerData['/'][mode][page]}        
    }},
    routers: {configurable: false, enumerable: true, writable: false, value: {}},
    setRouter: {configurable: false, enumerable: true, writable: false, value: function(name, handler) {
        this.routers[name] = handler.bind(this)
    }},
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
    _eObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _eThemeObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _eventTargets: {configurable: false, enumerable: false, writable: false, value: {}},
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && (tagName == 'Image' || tagName == 'Audio' || (tagName.startsWith('HTML') && tagName.endsWith('Element')))
    }},
    _doHandler: {configurable: false, enumerable: false, writable: false, value: async function(event, processors, element) {
        let processorData = {}
        const parseSource = (source, container) => {
            if (typeof source === 'object') {
                Object.assign(processorData, source)
            } else if (typeof source === 'string' && container && (typeof container === 'object') && source in container) {
                const parseTest = parseSource(container[source])
                parseTest && typeof parseTest === 'object' && Object.assign(processorData, parseTest)
            } else if (typeof source === 'string' && source.startsWith('`') && source.endsWith('`') ) {
                try {
                    const parseTest = JSON.parse(source.slice(1,-1))
                    parseTest && typeof parseTest === 'object' && Object.assign(processorData, parseTest)
                } catch(e) {}
            }
        }
        element.getAttribute(`e-source`) && parseSource(element.getAttribute('e-source'), element.eDataset)
        element.getAttribute(`e-source-${event.type}`) && parseSource(element.getAttribute(`e-source-${event.type}`), element.eDataset)
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
        if (processorData && typeof processorData === 'object' && 'eReduce' in processorData) {
            processorData = (processorData.eReduce instanceof Function) ? processorData.eReduce(processorData) : processorData.eReduce
        }
        if (processorData && typeof processorData === 'object' && processorData.eSink && typeof processorData.eSink === 'string') {
            const eSink = processorData.eSink
            delete processorData.eSink
            element[eSink] = (element[eSink] && typeof element[eSink] === 'object') ? Object.assign(element[eSink], processorData) : processorData
        } else if (event.eSink && typeof event.eSink === 'string') {
            element.eSink[event.eSink] = (element.eSink[event.eSink] && typeof element.eSink[event.eSink] === 'object')
                ? Object.assign(element.eSink[event.eSink], processorData) : processorData
        } else if (event.eSink && typeof event.eSink === 'object') {
            event.eSink = (event.eSink && typeof event.eSink === 'object')
                ? Object.assign(event.eSink, processorData) : processorData
        } else if (element.getAttribute(`e-sink-${event.type}`)) {
            const eSink = element.getAttribute(`e-sink-${event.type}`)
            element.eSink[eSink] = (element.eSink[eSink] && typeof element.eSink[eSink] === 'object') 
                ? Object.assign(element.eSink[eSink], processorData) : processorData
        } else if (element.getAttribute('e-sink')) {
            const eSink = element.getAttribute('e-sink')
            element.eSink[eSink] = (element.eSink[eSink] && typeof element.eSink[eSink] === 'object') 
                ? Object.assign(element.eSink[eSink], processorData) : processorData
        } else if (processorData && typeof processorData === 'object') {
            Object.assign(element.eDataset, processorData)
        }
   }},
    _getModule: {configurable: false, enumerable: false, writable: false, value: async function(tag, dryRun=false) {
        if (this.modules[tag]) return this.modules[tag]
        if (!tag.includes('-')) return
        const [tagRepo, tagModule] = tag.split('-')
        if (!this.repos[tagRepo]) return
        const fileNameSuffix = tagModule.includes('.') ? tagModule.split('.', 2)[1] : this.repos[tagRepo].modules.suffix || 'wasm',
            tagModuleFileName = tagModule.includes('.') ? tagModule : `${tagModule}.${fileNameSuffix}`
        if (fileNameSuffix === 'wasm') {
            const moduleObject = await WebAssembly.instantiateStreaming(fetch(`${this.repos[tagRepo].base}${this.repos[tagRepo].modules.path}${tagModuleFileName}`))
            if (dryRun) return moduleObject 
            return this.modules[tag] = moduleObject.instance
        } else {
            const importedModule = await import(`${this.repos[tagRepo].base}${this.repos[tagRepo].modules.path}${tagModuleFileName}`)
            if (dryRun) return importedModule
            return this.modules[tag] = importedModule
        }
    }},
    _parseDo: {configurable: false, enumerable: false, writable: false, value: async function*(element, doValue) {
        const _parseProcessorFragment = async processorFragment => {
            const [repoModuleTag, functionSignature] = processorFragment.split('.'), [functionName, functionDecoratorsSignature] = functionSignature.split('@')
            let coreFunction, decoratedFunction = coreFunction
            if (this.processors[repoModuleTag]) coreFunction = this.processors[repoModuleTag][functionName] || this.processors['404']
            coreFunction ||= await this._getModule(repoModuleTag)?.functionName || this.processors['404']
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
                proxy = proxyFragment==='@'?element.eDataset:(proxyFragment?this.proxies[proxyFragment]:undefined)
            return [doStatment, eventTarget, eventType, processors, proxy, eventTargetKey]
        }
        for (const doStatement of (doValue || element.getAttribute('e-do') || '').split(' ')) yield await [..._parseDoStatement(doStatement)]
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



    loadContent: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        let metaElements, eContentNode = rootElement, eLayoutNode = rootElement, defaultContentTag = `content-${this.env.options.defaultPages.content}`, 
            defaultLayoutTag = `layout-${this.env.options.defaultPages.layout}`
        if (!rootElement) {
            const metaElements = document.head.getElementsByTagName('meta')
            eContentNode =  metaElements['e-content']
            eLayoutNode = metaElements['e-layout']
        }
        const values = {content: eContentNode?.getAttribute(`${rootElement?'e-':''}content`) || defaultContentTag, 
                layout: eLayoutNode?.getAttribute(rootElement?'e-layout':'content') || defaultLayoutTag}
        for (const mode in values) {
            const tag = values[mode]
            if (tag.includes('(') && tag.endsWith(')')) {
console.log('line 236', mode, tag)
                let [routerName, routerArgs] = tag.split('(')
                routerArgs = routerArgs.slice(0, -1).split(',')
                this.routers[routerName] || this.setRouter('/', this._routerHandlerDefault)
                values[mode] = await this.routers[routerName](mode, rootElement, document.location, this.env, ...routerArgs)
            } else if (tag.includes('-')) {
console.log('line 242', mode, tag)
                const [repoName, pageName] = tag.split('-'), repo = this.repos[repoName] || {}
                values[mode] = await fetch(`${repo.base||'./'}${repo[mode]?.path||`${mode}/`}${pageName||repo[mode]?.index||this.env.options.defaultPages[mode]}.${repo[mode]?.suffix||this.env.options.defaultSuffixes[mode]}`).then(r => r.text())
            }
        }



    }},


    autoload: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        !rootElement && document?.head?.getElementsByTagName('meta')?.namedItem('generator')?.getAttribute('content') === 'Element'  && this.loadContent()
        rootElement && (rootElement.hasAttribute('e-layout') || rootElement.hasAttribute('e-content')) && this.loadContent(rootElement)
        rootElement || this._enscapulateNative()
        const rootElementTagName = rootElement?.tagName?.toLowerCase()
        rootElement && (this.ids[rootElementTagName] || await this.activateTag(rootElementTagName))
        this.applyTheme(rootElement)
        rootElement?.hasAttribute('e-do') && await this._setupDo(element)
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element?.tagName?.includes('-')) continue
            const tagName = element.tagName.toLowerCase()
            await this.autoload(element)
        }
        observerRoot._eObserver ||= new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                for (const addedNode of (mutationRecord.addedNodes||[])) if (addedNode?.tagName?.includes('-')) await this.autoload(addedNode)
                if (mutationRecord.attributeName === 'eh-do') await this._setupDo(mutationRecord.target, mutationRecord.oldValue)
            }
        })
        observerRoot._eObserver.observe(domRoot, {subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['eh-do']})
        if (rootElement) return
        this._eThemeObserver ||= new MutationObserver(mutationList => {
            for (const mutationRecord of mutationList) mutationRecord.attributeName === 'eh-theme' || this.applyTheme(undefined, true)
        })
        this._eThemeObserver.observe(document.body, {subtree: false, childList: false, attributes: true, attributeFilter: ['eh-theme']})
    }},
    applyTheme: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined, recurse=false) {
        const themeTag = (rootElement||document.body).getAttribute('e-theme'),
            [themeName=(this.appliedTheme||'theme'), themeSheet='index'] = themeTag ? themeTag.split('-') : []
        if (!this.themes[themeName]) return
        this.appliedTheme = themeName
        const domRoot = rootElement ? rootElement.shadowRoot : document, themeSheetURL = `${this.themes[this.themeName]}${themeSheet}.css`,
            themeSheetElement = domRoot.querySelector(`${rootElement?'style':'link'}[e-theme="${themeTag}"]`)
            || (rootElement?domRoot.querySelectorAll('style')[0]:domRoot.head).insertAdjacentElement(`${rootElement?'after':'before'}end`,
                document.createElement(rootElement?'style':'link'))
        themeSheetElement.setAttribute('e-theme', themeTag)
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
    copyAttributes: {configurable: false, enumerable: true, writable: false, value: function(source, target, keep=[], autoKeepE=false) {
        for (const a in source.getAttributeNames()) {
            if (!keep.includes(a) && !((autoKeepE) && a.startsWith('e-'))) continue
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
        const [tagRepo, tagComponent] = tagName.split('-', 2).map(t => t.toLowerCase())
        return (this.repos[tagRepo])
            ? (new URL(`${this.repos[tagRepo].base}${this.repos[tagRepo].elements.path}${tagComponent}.${this.repos[tagRepo].elements.suffix}`, document.location)).href
            : (new URL(`${('./'+tagRepo+'/')}${tagComponent}.html`, document.location)).href
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
                    WebAssembly.instantiateStreaming(fetch($this.constructor.eWasm[moduleName].src),
                        $this.constructor.eWasm[moduleName].importObject).then(importResult => 
                            $this.constructor.eWasmModules[moduleName] = importResult
                    ).catch(e => $this.constructor.eWasmModules[moduleName] = {})
                }
                if (!$this.constructor.tagPrefixes) for (r in ($this.constructor.repos || [])) $this.constructor.tagPrefixes[r] = crypto.randomUUID().replace(/\-/g, '')
                $this.constructor.eConstraints ||= {}
                $this.constructor.eSanitizers ||= {}
                $this.eLocalConstraints ||= {}
                $this.eLocalSanitizers ||= {}
                $this.eQueuedAttributes = {}
                $this.eDataset = new Proxy($this.dataset, {
                    has(target, property) {
                        if (!'@#.>'.includes(property[0])) return property.trim() in target 
                            || !!$this.shadowRoot.querySelector(`:scope > [e-prop="${property.trim()}"]:not(e-slot)`)
                        return ((property[0] === '@') && $this.hasAttribute(property.slice(1)))
                            || ((property[0] === '#') && property.slice(1) in $this)
                            || ((property[0] === '.') && !!$this.shadowRoot.querySelector(`:scope > [e-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && !!$this.shadowRoot.querySelector(`:scope > e-slot[e-prop="${property.slice(1)}"]`))
                    },
                    get(target, property, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (property in target) return target[property]
                            const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [e-prop="${property}"]:not(e-slot)`)
                            return propertyRenderer ? Object.assign({}, (propertyRenderer.eDataset || {})) : undefined
                        }
                        return ((property[0] === '@') && $this.getAttribute(property.slice(1)))
                            || ((property[0] === '#') && $this[property.slice(1)])
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [e-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > e-slot[e-prop="${property.slice(1)}"]`))
                    },
                    set(target, property, value, receiver) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (value && (target[property] === value)) return true
                            let sanitized = false, sanitizedDetails = '', withinConstraint = true, withinConstraintDetails = '',
                                returnValue = undefined
                            const oldValue = target[property], givenValue = value, sanitizer = $this.eLocalSanitizers[property] 
                                || $this.constructor.eSanitizers[property],constraint = $this.eLocalConstraints[property] 
                                || $this.constructor.eConstraints[property]
                            typeof sanitizer === 'function' && ([value, sanitized, sanitizedDetails] = sanitizer(value))
                            typeof constraint === 'function' && ([withinConstraint, withinConstraintDetails] = constraint(value))
                            value ?? (returnValue = this.deleteProperty(target, property))
                            if (value && typeof value === 'object') {
                                let propertyRenderer = $this.shadowRoot.querySelector(`:scope > [e-prop="${property}"]`)
                                if (propertyRenderer) {
                                    if (propertyRenderer.tagName.toLowerCase() === 'e-slot') {
                                        const useTagRepository = eSlot.getAttribute('e-repo'),
                                            useTagSuffix = eSlot.getAttribute('e-suffix')
                                        if (useTagRepository && useTagSuffix && $this.constructor.tagPrefixes[useTagRepository]) {
                                            const useTag = `${$this.constructor.tagPrefixes[useTagRepository]}-${useTagSuffix}`, eSlot = propertyRenderer
                                            propertyRenderer = document.createElement(useTag)
                                            Element.copyAttributes(eSlot, propertyRenderer, (eSlot.getAttribute('e-keep') || '').split(' ').filter(a => !!a), true)
                                            eSlot.replaceWith(propertyRenderer)
                                        } else {
                                            throw new TypeError(`Either e-repo, e-suffix are not set, or are set and do not match a repository for element class with id ${this.constructor.eTagId} property ${property}`)
                                            returnValue = false
                                        }
                                    }
                                    for (const k in propertyRenderer.eDataset) (k in value) || delete propertyRenderer.eDataset[k]
                                    for (const k in value) if (propertyRenderer.eDataset[k] !== value[k]) propertyRenderer.eDataset[k] = value[k]
                                    returnValue = true
                                } else {
                                    throw new TypeError(`No sub-element found in the shadowRoot with an e-prop equal to ${property} for this instance of element class ${this.constructor.eTagId}`)
                                    returnValue = false
                                }
                            } else {
                                returnValue = !!(target[property] = value)
                            }
                            const eventDetail = {givenValue: givenValue, value: value, oldValue: oldValue, sanitized: sanitized,
                                sanitizedDetails: sanitizedDetails,withinConstraint: withinConstraint, withinConstraintDetails: withinConstraintDetails}
                            Element._dispatchPropertyEvent('change', property, eventDetail)
                            const validator = $this.eLocalValidator || $this.constructor.eValidator
                            if (typeof validator == 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.eDataset))
                                Object.assign(eventDetail, {handler: 'set', isValid: isValid, validatorDetails: validatorDetails})
                                Element._dispatchPropertyEvent('e-dataset-validation', property, eventDetail)
                            }
                            return returnValue
                        }
                        Element._dispatchPropertyEvent('change', property, {value: value})
                        return ((property[0] === '@') && $this.setAttribute(property.slice(1), value))
                            || ((property[0] === '#') && ($this[property.slice(1)] = value))
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [e-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > e-slot[e-prop="${property.slice(1)}"]`))
                    }, 
                    deleteProperty(target, property) {
                        if (!'@#.>'.includes(property[0])) {
                            property = property.trim()
                            let returnValue, oldValue = target[property]
                            if (property in target) {
                                returnValue = delete target[property]
                            } else {
                                const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [e-prop="${property}"]:not(e-slot)`)
                                if (propertyRenderer) {
                                    const eSlot = document.createElement('e-slot')
                                    Element.copyAttributes(propertyRenderer, eSlot, (propertyRenderer.getAttribute('e-keep') || '').split(' ').filter(a => !!a), true)
                                    propertyElement.replaceWith(eSlot)
                                }
                                returnValue = true
                            }
                            Element._dispatchPropertyEvent('e-dataset-delete-property', property, {oldValue: oldValue})
                            const validator = $this.eLocalValidator || $this.constructor.eValidator
                            if (typeof validator === 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.eDataset))
                                Element._dispatchPropertyEvent('e-dataset-validation', property, {handler: 'deleteProperty', property: property,
                                    oldValue: oldValue, isValid: isValid, validatorDetails: validatorDetails})
                            }
                            return returnValue
                        }
                        return ((property[0] === '@') && $this.removeAttribute(property.slice(1)))
                            || ((property[0] === '#') && delete $this[property.slice(1)])
                            || ((property[0] === '.') && !$this.shadowRoot.querySelector(`:scope > [e-prop="${property.slice(1)}"]`)?.remove())
                            || ((property[0] === '>') && !$this.shadowRoot.querySelector(`:scope > e-slot[e-prop="${property.slice(1)}"]`)?.remove())
                    }
                })
                $this.shadowRoot || $this.attachShadow({mode: 'open'})
                $this.shadowRoot.textContent = ''
                $this.shadowRoot.appendChild(document.createElement('style')).textContent = Element.stackStyles(this.constructor.eTagId)
                const templateNode = document.createElement('template')
                templateNode.innerHTML = Element.stackTemplates(this.constructor.eTagId)
                $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
            }
            static get observedAttributes() { return [] }
            attributeChangedCallback(attrName, oldVal, newVal) { this[attrName] = newVal }
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
        }
    }}
})
Object.defineProperty(Element.env, 'Element', {configurable: false, enumerable: true, writable: false, value: Element})
Object.defineProperty(Element, 'eventTargets', {configurable: false, enumerable: true, writable: false, value: new Proxy(Element._eventTargets, {
    get: (target, prop, receiver) => {
        if  (!target[prop] && !target[prop] instanceof Object && !target[prop] instanceof EventTarget) {
            target[prop] = {_e: {},
                addEventListener: (type, listener, options, element, doStatement) => {
                    if (!element || !doStatement) return
                    target[prop]._e[element] ||= {}
                    target[prop]._e[element][doStatement] ||= [type, listener, options]
                },
                removeEventListener: (type, listener, options, element, doStatement) => {
                    if (!element || !doStatement) return
                    target[prop]._e[element] ||= {}
                    delete target[prop]._e[element][doStatement]
                    !Object.keys(target[prop]._e[element]).length && (delete target[prop]._e[element])
                },
                dispatchEvent: () => {}
            }
        }
        return target[prop]
    },
    has: (target, prop) => target[prop] instanceof EventTarget,
    set: function(target, prop, value, receiver) {
        if (value instanceof EventTarget) {
            if (!(target[prop] instanceof EventTarget) && (target[prop] instanceof Object) && (target[prop]._e instanceof Object)) for (const listenerParams of target[prop]._) value.addEventListener(...listenerParams)
            target[prop] = value
        }
    }
})})
export { Element }