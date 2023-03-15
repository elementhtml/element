const Element = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'},
    repositories: {configurable: false, enumerable: true, writable: false, value: {}},
    suffixes: {configurable: false, enumerable: true, writable: false, value: {}},
    ids: {configurable: false, enumerable: true, writable: false, value: {}},
    tagNames: {configurable: false, enumerable: true, writable: false, value: {}},
    extends: {configurable: false, enumerable: true, writable: false, value: {}},
    files: {configurable: false, enumerable: true, writable: false, value: {}},
    styles: {configurable: false, enumerable: true, writable: false, value: {}},
    templates: {configurable: false, enumerable: true, writable: false, value: {}},
    scripts: {configurable: false, enumerable: true, writable: false, value: {}},
    classes: {configurable: false, enumerable: true, writable: false, value: {}},
    constructors: {configurable: false, enumerable: true, writable: false, value: {}},
    eventTargets: {configurable: false, enumerable: true, writable: false, value: {}},
    processors: {configurable: false, enumerable: true, writable: false, value: {}},
    themes: {configurable: false, enumerable: true, writable: false, value: {}},
    appliedTheme: {configurable: false, enumerable: true, writable: true, value: undefined},
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && (tagName == 'Image' || tagName == 'Audio' || (tagName.startsWith('HTML') && tagName.endsWith('Element')))
    }},

    _processFrom: {configurable: false, enumerable: false, writable: false, value: function(element, newValue) {
        if (newValue) {
            for (const eventTargetConfig of newValue.split(' ')) {
                const [eventTargetTag, processorList=''] = eventTargetConfig.split(':', 2), 
                    [eventTargetName, eventName] = eventTargetTag.split('-'). processors = processorList.split(':')
                if (!eventTargetName || !eventName || !(this.eventTargets[eventTargetName] instanceof EventTarget)) continue
                this.eventTargets[eventTargetName].addEventListener(eventName, event => {
                    let processorData, b37EventToJson = event?.b37EventToJson || event?.target?.b37EventToJson
                    if (b37EventToJson) {
                        try { processorData = JSON.parse(event[b37EventToJson] || 'null')} cach(e) { processorData = null }
                    } else if (event.formData instanceof FormData) { 
                        for (k in event.formData) processorData[k] = event.formData[k]
                    } else {
                        processorData ||= event.detail instanceof Object && event.detail
                        processorData ||= event.data instanceof Object && event.data
                        processorData ||= event?.target?.b37Dataset
                        processorData ||= {}
                    }
                    for (const processor of processors) {
                        if (typeof Element.processors[processor] === 'function') processorData = Object.assign(processorData, this.processors[processor](processorData, event))
                    }
                    Object.assign(element.b37Dataset, processorData)
                })
            }
        } else {

        }
    }},
    _b37ElementObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _b37ElementThemeObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        rootElement || this.applyTheme()
        rootElement || this._enscapulateNative()
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'],
            observerRoot = rootElement || this
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element?.tagName?.includes('-')) continue
            const tagName = element.tagName.toLowerCase()
            this.ids[tagName] || await this.activateTag(tagName)
            for (const customElement of domTraverser.call(domRoot, tagName)) this.applyTheme(customElement, true)
        }
        observerRoot._b37ElementObserver ||= new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                if (mutationRecord.type === 'childList') {
                    for (const addedNode of mutationRecord.addedNodes) {
                        if (!addedNode?.tagName?.includes('-')) continue
                        const tagName = addedNode.tagName.toLowerCase()
                        this.ids[tagName] || await this.activateTag(tagName)
                        for (const customElement of domTraverser.call(domRoot, tagName)) this.applyTheme(customElement, true)
                    }
                } else if (mutationRecord.type === 'attributes') {
                    if (mutationRecord.attributeName === 'b37-from') {
                        this._processFrom(mutationRecord.target, mutationRecord.target.getAttribute('b37-from'), mutationRecord.oldValue)
                    }
                }

            }
        })
        observerRoot._b37ElementObserver.observe(domRoot, {subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['b37-from']})
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
        rootElement && (themeSheetElement.innerHTML = `@import "${themeSheetURL}";`)
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
    stackTemplates: {configurable: false, enumerable: true, writable: false, value: async function(tagId, templateInnerHTML=undefined) {
        const template = document.createElement('template')
        template.innerHTML = templateInnerHTML || this.templates[tagId]
        for (const t of template.content.querySelectorAll('template[id]')) {
            const idAttr = t.getAttribute('id'), tId = idAttr.match(/^[a-z0-9]+-[a-z0-9]+/) ? this.getTagId(idAttr) : idAttr,
                tNode = document.createElement('template')
            this.templates[tId] || await this.loadTagAssetsFromId(tId)
            tNode.innerHTML = await this.stackTemplates(tId)
            const clonedNode = tNode.content.cloneNode(true)
            if (t.hasAttribute('slot')) {
                const tSlot = t.getAttribute('slot'), targetSlot = clonedNode.querySelector(`slot[name="${tSlot}"]`)
                    || clonedNode.querySelector(tSlot || 'slot') || clonedNode.querySelector('slot')
                targetSlot && targetSlot.replaceWith(await this.stackTemplates(undefined, t.innerHTML))
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
        return (new URL(`${this.repositories[tagRepository] || ('./'+tagRepository+'/')}${tagComponent}${this.suffixes[tagRepository] || '.html'}`, document.location)).href
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
                        if ('@#.>'.includes(property[0])) {
                            property = property.trim()
                            if (value && (target[property] === value)) return true
                            let sanitized = false, sanitizedDetails = '', withinConstraint = true, withinConstraintDetails = '',
                                returnValue = undefined
                            const givenValue = value, sanitizer = $this.b37LocalSanitizers[property] || $this.constructor.b37Sanitizers[property],
                                constraint = $this.b37LocalConstraints[property] || $this.constructor.b37Constraints[property]
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
                            $this.dispatchEvent(new CustomEvent('b37DatasetSet', {detail: {
                                property: property, givenValue: givenValue, value: value, sanitized: sanitized, sanitizedDetails: sanitizedDetails,
                                withinConstraint: withinConstraint, withinConstraintDetails: withinConstraintDetails
                            }}))
                            const validator = $this.b37LocalValidator || $this.constructor.b37Validator
                            if (typeof validator == 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                $this.dispatchEvent(new CustomEvent('b37DatasetValidation', {detail: {
                                    handler: 'set', property: property, isValid: isValid, validatorDetails: validatorDetails
                                }}))
                            } 
                            return returnValue
                        }
                        return ((property[0] === '@') && $this.setAttribute(property.slice(1), value))
                            || ((property[0] === '#') && ($this[property.slice(1)] = value))
                            || ((property[0] === '.') && $this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`))
                            || ((property[0] === '>') && $this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`))
                    }, 
                    deleteProperty(target, property) {
                        if ('@#.>'.includes(property[0])) {
                            property = property.trim()
                            let returnValue
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
                            const validator = $this.b37LocalValidator || $this.constructor.b37Validator
                            if (typeof validator === 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                $this.dispatchEvent(new CustomEvent('b37DatasetValidation', {detail: {
                                    handler: 'deleteProperty', property: property, isValid: isValid, validatorDetails: validatorDetails
                                }}))
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
                $this.shadowRoot.innerHTML = ''
                $this.shadowRoot.appendChild(document.createElement('style')).innerHTML = Element.stackStyles(this.constructor.b37TagId)
                Element.stackTemplates(this.constructor.b37TagId).then(innerHTML => {
                    const templateNode = document.createElement('template')
                    templateNode.innerHTML = innerHTML
                    $this.shadowRoot.appendChild(templateNode.content.cloneNode(true))
                })
                Element.autoload($this)
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