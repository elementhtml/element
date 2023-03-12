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
    themes: {configurable: false, enumerable: true, writable: false, value: {}},
    themeSheets: {configurable: false, enumerable: true, writable: false, value: {}},
    appliedTheme: {configurable: false, enumerable: true, writable: true, value: undefined},
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && (tagName == 'Image' || tagName == 'Audio' || (tagName.startsWith('HTML') && tagName.endsWith('Element')))
    }},
    _globalObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    _themeObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined) {
        rootElement ?? this.applyTheme() 
        rootElement ?? this._enscapulateNative()
        const domRoot = rootElement ? rootElement.shadowRoot : document, domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName'], 
            observerRoot = rootElement ?? this, observerName = rootElement ? '_b37Observer' : '_globalObserver'
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element?.tagName?.includes('-')) continue
            const tagName = element.tagName.toLowerCase()
            this.ids[tagName] ?? await this.activateTag(tagName)
            for (const customElement of domTraverser.call(domRoot, tagName)) {
                this.applyTheme(customElement, true)
            }
        }
        observerRoot[observerName] = observerRoot[observerName] ?? new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                for (const addedNode of mutationRecord.addedNodes) {
                    if (!addedNode?.tagName?.includes('-')) continue 
                    const tagName = addedNode.tagName.toLowerCase()
                    this.ids[tagName] ?? await this.activateTag(tagName)
                    for (const customElement of domTraverser.call(domRoot, tagName)) {
                        this.applyTheme(customElement, true)
                    }
                }
            }
        })
        observerRoot[observerName].observe(domRoot, {subtree: true, childList: true, attributes: false})
        if (rootElement) return
        this._themeObserver = this._themeObserver ?? new MutationObserver(mutationList => {
            for (const mutationRecord of mutationList) {
                if (mutationRecord.attributeName == 'b37-theme') this.applyTheme(undefined, true)
            }
        })
        this._themeObserver.observe(document.body, {subtree: false, childList: false, attributes: true, attributeFilter: ['b37-theme']})
    }},
    applyTheme: {configurable: false, enumerable: true, writable: false, value: async function(rootElement=undefined, recurse=false) {
        const themeTag = (rootElement?rootElement:document.body).getAttribute('b37-theme'),
            [themeName = 'theme', themeSheet = 'index'] = themeTag ? themeTag.split('-') : []
        if (!(themeName && themeSheet && this.themes[themeName])) return
        this.appliedTheme = themeName
        const domRoot = rootElement ? rootElement.shadowRoot : document, themeSheetURL = `${this.themes[this.themeName]}${themeSheet}.css`,
            themeSheetElement = domRoot.querySelector(`style[b37-theme="${themeTag}"]`)
            ?? (rootElement?domRoot.querySelectorAll('style')[0]:domRoot.head).insertAdjacentElement(`${rootElement?'after':'before'}end`, 
                document.createElement('style'))
        themeSheetElement.setAttribute('b37-theme', themeTag)
        this.themeSheets[themeTag] = this.themeSheets[themeTag] ?? await fetch(themeSheetURL).then(r => r.text())
        themeSheetElement.innerHTML = this.themeSheets[themeTag]
        if (!recurse) return
        const domTraverser = domRoot[rootElement ? 'querySelectorAll' : 'getElementsByTagName']
        for (const element of domTraverser.call(domRoot, '*')) {
            if (!element.tagName.includes('-')) continue
            this.ids[element.tagName.toLowerCase()] && this.applyTheme(element, true)
        }
    }},    
    getInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagId='HTMLElement') {
        const inheritance = [tagId]
        while (tagId && !this._isNative(tagId) && this.extends[tagId]) { 
            inheritance.push(this.extends[tagId])
            tagId = this.extends[tagId] 
        }
        return inheritance
    }},
    sortByInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagIdList) {
        return Array.from(new Set(tagIdList)).filter(t => this.extends[t]).sort((a, b) => {
            if (this.extends[a] == b) {
                return -1
            } else if (this.extends[b] == a) {
                return 1
            } else {
                return this.getInheritance(b).indexOf(a)
            }
        }).map((v, i, a) => (i == a.length-1) ? [v, this.extends[v]] : v).flat()
    }},  
    copyAttributes: {configurable: false, enumerable: true, writable: false, value: function(source, target, keep=[], autoKeepB37=false) {
        for (const a in source.getAttributeNames()) {
            if (!(keep.includes(a) || ((autoKeepB37) && a.startsWith('b37-')))) continue
            const aValue = source.getAttribute(a)
            aValue === '' ? target.toggleAttribute(a, true) : (aValue ? target.setAttribute(a, aValue) : undefined)
        }
    }},


    stackTemplates: {configurable: false, enumerable: true, writable: false, value: async function(tagId, templateInnerHTML=undefined) {
        const template = document.createElement('template')
        template.innerHTML = templateInnerHTML || this.templates[tagId]
        for (const t of template.content.querySelectorAll('template[id]')) {
            const idAttr = t.getAttribute('id'), tId = idAttr.match(/^[a-z0-9]+-[a-z0-9]+/) ? this.getTagId(idAttr): idAttr, 
                tNode = document.createElement('template')
            if (!this.templates[tId]) {
                await this.loadTagAssetsFromId(tId)
            }
            tNode.innerHTML = await this.stackTemplates(tId)
            const clonedNode = tNode.content.cloneNode(true)
            if (t.hasAttribute('slot')) {
                const tSlot = t.getAttribute('slot'), targetSlot = clonedNode.querySelector(`slot[name="${tSlot}"]`) 
                    || tSlot ? clonedNode.querySelector(tSlot) : clonedNode.querySelector('slot') 
                    || clonedNode.querySelector('slot')
                if (targetSlot)  {
                    targetSlot.replaceWith(await this.stackTemplates(undefined, t.innerHTML))
                }
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
        if (this.ids[tagName]) {
            return this.ids[tagName]
        } else {
            const [tagRepository, tagComponent] = tagName.split('-', 2).map(t => t.toLowerCase())
            return (new URL(`${this.repositories[tagRepository] || ('./'+tagRepository+'/')}${tagComponent}${this.suffixes[tagRepository] || '.html'}`, document.location)).href
        }
    }}, 
    loadTagAssetsFromId: {configurable: false, enumerable: true, writable: false, value: async function(tagId, forceReload=false) {
        if (forceReload || !this.files[tagId]) {
            this.files[tagId] = await fetch(tagId).then(r => r.text())
            this.styles[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<style>')+7, this.files[tagId].indexOf('</style>')).trim()
            this.templates[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<template>')+10, this.files[tagId].indexOf('</template>')).trim()
            this.scripts[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<script>')+8, this.files[tagId].indexOf('</script>'))
                                        .trim()
            const extendsRegExp = /class\s+extends\s+`(?<extends>.+)`\s+\{/, 
                extendsClassAliasGroups = this.scripts[tagId].match(extendsRegExp)?.groups, 
                extendsClassAlias = extendsClassAliasGroups ? (extendsClassAliasGroups.extends) : undefined
            let extendsClassId = extendsClassAlias.match(/^[a-z0-9]+-[a-z0-9]+$/) ? this.getTagId(extendsClassAlias) : extendsClassAlias
            if (extendsClassId) {
                extendsClassId = this._isNative(extendsClassId) ? extendsClassId : (new URL(extendsClassId, document.location)).href
                this.extends[tagId] = extendsClassId
                if (!this.files[extendsClassId] && !this._isNative(extendsClassId)) {
                    await this.loadTagAssetsFromId(extendsClassId)
                }            
            }
            let sanitizedScript = this.scripts[tagId].replace(extendsRegExp, `class extends Element.constructors['${extendsClassId}'] {`)
            this.classes[tagId] = Function('Element', 'return ' + sanitizedScript)(this)
            const Element = this
            this.classes[tagId].__b37TagId = tagId
            this.constructors[tagId] = class extends this.classes[tagId] {
                constructor() {
                    super()
                }
            }            
        }
    }}, 
    activateTag: {configurable: false, enumerable: true, writable: false, value: async function(tagName, forceReload=false) {
        if (tagName.includes('-') && (forceReload || !this.ids[tagName]))  {
            const tagId = this.getTagId(tagName)
            this.ids[tagName] = tagId
            this.tagNames[tagId] = tagName
            await this.loadTagAssetsFromId(tagId, forceReload)
            const baseTagName = this.getInheritance(tagId).pop() || 'HTMLElement'
            if (baseTagName != 'HTMLElement' && this._isNative(baseTagName)) {
                globalThis.customElements.define(tagName, this.constructors[tagId], {extends: baseTagName})
            } else {
                globalThis.customElements.define(tagName, this.constructors[tagId])
            }
        }
    }}, 
    render: {configurable: false, enumerable: true, writable: false, value: async function(element, tagId, renderFunction=true, style=true, template=true) {
        if (element?.shadowRoot && typeof element.shadowRoot?.querySelector == 'function' && typeof element.shadowRoot?.prepend == 'function') {
            const useStyle = style && typeof style == 'string' ? (this.styles[style] ? this.styles[style] : style) : undefined
            useStyle = useStyle || (style && typeof style == 'boolean' && tagId && this.styles[tagId] ? this.styles[tagId] : undefined)
            useStyle = style === false ? undefined : useStyle
            if (useStyle) {
                const styleNode = document.createElement('style'), existingStyleNode = element.shadowRoot.querySelector('style')
                styleNode.innerHTML = useStyle
                existingStyleNode.after(styleNode)
            }
            const useTemplate = template && typeof template == 'string' ? (this.templates[template] ? this.templates[template] : template) : undefined
            useTemplate = useTemplate || (template && typeof template == 'boolean' && tagId && this.templates[tagId] ? this.templates[tagId] : undefined)
            useTemplate = template === false ? undefined : useTemplate
            if (useTemplate) {
                const mainStyleNode = element.shadowRoot.querySelector('style'), renderStyleNode = element.shadowRoot.querySelector('style + style')
                mainStyleNode = mainStyleNode ? mainStyleNode.cloneNode(true) : undefined
                renderStyleNode = renderStyleNode ? renderStyleNode.cloneNode(true) : undefined
                element.shadowRoot.innerHTML = await this.stackTemplates(undefined, useTemplate)
                if (renderStyleNode) {
                    element.shadowRoot.prepend(renderStyleNode)
                }
                if (mainStyleNode) {
                    element.shadowRoot.prepend(mainStyleNode)
                }
            }
            const renderFunction = renderFunction && typeof renderFunction == 'function' ? renderFunction : undefined
            renderFunction = renderFunction || (renderFunction && typeof renderFunction == 'boolean' && tagId && this.constructors[tagId] && typeof this.constructors[tagId].__render == 'function' ? this.constructors[tagId].__render : undefined)
            renderFunction = renderFunction === false ? undefined : renderFunction
            if (renderFunction && typeof renderFunction == 'function') {
                await renderFunction(element, tagId, style, template)
            }
        }
    }}, 
    _enscapulateNative: {configurable: false, enumerable: false, writable: false, value: function() {
        Reflect.ownKeys(globalThis).filter(k => this._isNative(k)).forEach(nativeClassName => {
            if (!this.classes[nativeClassName]) {
                if (nativeClassName == 'HTMLImageElement') {
                    this.classes[nativeClassName] = globalThis['Image']
                } else if (nativeClassName == 'HTMLAudioElement') {
                    this.classes[nativeClassName] = globalThis['Audio']
                } else {
                    this.classes[nativeClassName] = globalThis[nativeClassName]
                }
            }
            if (!this.constructors[nativeClassName]) {
                this.constructors[nativeClassName] = this._base(this.classes[nativeClassName])
            }
        })
    }}, 
    _base: {configurable: false, enumerable: false, writable: false, value: function(baseClass=globalThis.HTMLElement) {
        return class extends baseClass {
            constructor() {
                super()
                const $this = this, addSrcToDocument = (querySelectorTemplate, src, tagName, srcAttrName, appendTo, otherAttrs=[]) => {
                    let tag = document.querySelector(querySelectorTemplate.replace(/\$B37/g, src))
                    if (!tag) {
                        tag = document.createElement(tagName)
                        tag.setAttribute(srcAttrName, src)
                        otherAttrs.forEach(a => tag.setAttribute(...a))
                        appendTo.append(tag)
                    }
                }
                ;($this.constructor.b37Js || []).forEach(src => {
                    addSrcToDocument('script[src="$B37"]', src, 'script', 'src', document.body)
                })
                ;($this.constructor.b37Mjs || []).forEach(src => {
                    addSrcToDocument('script[src="$B37"]', src, 'script', 'src', document.body, [['type', 'module']])
                })
                ;($this.constructor.b37Css || []).forEach(src => {
                    addSrcToDocument('link[rel="stylesheet"][href="$B37"]', src, 'link', 'href', document.head, [['rel', 'stylesheet']])
                })
                $this.constructor.b37WasmModules = $this.constructor.b37WasmModules ?? {}
                Object.keys($this.constructor.b37Wasm || {}).forEach(moduleName => {
                    if ($this.constructor.b37WasmModules[moduleName] === undefined) {
                        $this.constructor.b37WasmModules[moduleName] = true
                        WebAssembly.instantiateStreaming(fetch($this.constructor.b37Wasm[moduleName].src), 
                            $this.constructor.b37Wasm[moduleName].importObject).then(importResult => 
                                $this.constructor.b37WasmModules[moduleName] = importResult
                        ).catch(e => {
                            $this.constructor.b37WasmModules[moduleName] = false
                        })
                    }
                })
                if (Array.isArray($this.constructor.repositories) && !$this.constructor.tagPrefixes) {
                    $this.constructor.tagPrefixes = Object.assign($this.constructor.repositories.map(r => ({[r]: crypto.randomUUID().replace(/\-/g, '')})))
                }                
                $this.constructor.b37Constraints = $this.constructor.b37Constraints ?? {}
                $this.constructor.b37Sanitizers = $this.constructor.b37Sanitizers ?? {}
                $this.b37LocalConstraints = $this.b37LocalConstraints ?? {}
                $this.b37LocalSanitizers = $this.b37LocalSanitizers ?? {}
                $this.b37QueuedAttributes = {}
                $this.b37Dataset = new Proxy($this.dataset, {
                    has(target, property) {
                        if (property[0] === '@') {
                            return $this.hasAttribute(property.slice(1))
                        } else if (property[0] === '#') {
                            return property.slice(1) in $this
                        } else if (property[0] === '.') {
                            return !!$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`)
                        } else if (property[0] === '>') {
                            return !!$this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`)
                        } else {
                            return property.trim() in target || !!$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.trim()}"]:not(b37-slot)`)
                        }
                    }, 
                    get(target, property, receiver) {
                        if (property[0] === '@') {
                            return $this.getAttribute(property.slice(1))
                        } else if (property[0] === '#') {
                            return $this[property.slice(1)]
                        } else if (property[0] === '.') {
                            return $this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`)
                        } else if (property[0] === '>') {
                            return $this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`)
                        } else {
                            property = property.trim()
                            if (property in target) {
                                return target[property]
                            } else {
                                const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]:not(b37-slot)`)
                                if (propertyRenderer) {
                                    return Object.assign({}, (propertyRenderer.b37Dataset ?? {}))
                                } else {
                                    return undefined
                                }
                            }
                        }
                    }, 
                    set(target, property, value, receiver) {
                        if (property[0] === '@') {
                            return $this.setAttribute(property.slice(1), value)
                        } else if (property[0] === '#') {
                            return $this[property.slice(1)] = value
                        } else if (property[0] === '.') {
                            return $this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`)
                        } else if (property[0] === '>') {
                            return $this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`)
                        } else {
                            property = property.trim()
                            if (value && (target[property] === value)) {
                                return true
                            } else {
                                let sanitized = false, sanitizedDetails = '', withinConstraint = true, withinConstraintDetails = '', 
                                    returnValue = undefined
                                const givenValue = value, sanitizer = $this.b37LocalSanitizers[property] ?? $this.constructor.b37Sanitizers[property], 
                                    constraint = $this.b37LocalConstraints[property] ?? $this.constructor.b37Constraints[property]
                                if (sanitizer && typeof sanitizer == 'function') {
                                    [value, sanitized, sanitizedDetails] = sanitizer(value)
                                } 
                                if (constraint && typeof constraint == 'function') {
                                    [withinConstraint, withinConstraintDetails] = constraint(value)
                                }
                                if (value === undefined || value === null) {
                                    returnValue = this.deleteProperty(target, property)
                                } else if (value && typeof value == 'object') {
                                    let propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]`)
                                    if (propertyRenderer) {
                                        if (propertyRenderer.tagName.toLowerCase() == 'b37-slot') {
                                            const useTagRepository = b37slot.getAttribute('b37-repo'), 
                                                useTagSuffix = b37slot.getAttribute('b37-suffix')
                                            if (useTagRepository && useTagSuffix && $this.constructor.tagPrefixes[useTagRepository]) {
                                                const useTag = `${$this.constructor.tagPrefixes[useTagRepository]}-${useTagSuffix}`, b37slot = propertyRenderer
                                                propertyRenderer = document.createElement(useTag)
                                                Element.copyAttributes(b37slot, propertyRenderer, (b37slot.getAttribute('b37-keep') || '').split(' ').filter(a => !!a), true)
                                                b37slot.replaceWith(propertyRenderer)
                                            } else {
                                                throw new TypeError(`Either b37-repo, b37-suffix are not set, or are set and do not match a repository for element class with id ${this.constructor.__b37TagId} property ${property}`)
                                                returnValue = false
                                            }
                                        }
                                        Object.keys(propertyRenderer.b37Dataset).forEach(k => !(k in value) ? delete propertyRenderer.b37Dataset[k] : null)
                                        Object.keys(value).forEach(k => propertyRenderer.b37Dataset[k] !== value[k] ? propertyRenderer.b37Dataset[k] = value[k] : null )
                                        returnValue = true
                                    } else {
                                        throw new TypeError(`No sub-element found in the shadowRoot with a b37-prop equal to ${property} for this instance of element class ${this.constructor.__b37TagId}`)
                                        returnValue = false
                                    }
                                } else {
                                    returnValue = !!(target[property] = value)
                                }
                                $this.dispatchEvent(new CustomEvent('b37DatasetSet', {detail: {
                                    property: property, givenValue: givenValue, value: value, 
                                    sanitized: sanitized, sanitizedDetails: sanitizedDetails, 
                                    withinConstraint: withinConstraint, withinConstraintDetails: withinConstraintDetails
                                }}))
                                const validator = $this.b37LocalValidator ?? $this.constructor.b37Validator
                                if (validator && typeof validator == 'function') {
                                    let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                    $this.dispatchEvent(new CustomEvent('b37DatasetValidation', {detail: {
                                        handler: 'set', property: property, 
                                        isValid: isValid, validatorDetails: validatorDetails
                                    }}))
                                } 
                                return returnValue
                            }
                        }
                    }, 
                    deleteProperty(target, property) {
                        if (property[0] === '@') {
                            return $this.removeAttribute(property.slice(1))
                        } else if (property[0] === '#') {
                            return delete $this[property.slice(1)]
                        } else if (property[0] === '.') {
                            return !$this.shadowRoot.querySelector(`:scope > [b37-prop="${property.slice(1)}"]`)?.remove()
                        } else if (property[0] === '>') {
                            return !$this.shadowRoot.querySelector(`:scope > b37-slot[b37-prop="${property.slice(1)}"]`)?.remove()
                        } else {
                            property = property.trim()
                            let returnValue = undefined
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
                            const validator = $this.b37LocalValidator ?? $this.constructor.b37Validator
                            if (validator && typeof validator == 'function') {
                                let [isValid, validatorDetails] = validator(Object.assign({}, $this.b37Dataset))
                                $this.dispatchEvent(new CustomEvent('b37DatasetValidation', {detail: {
                                    handler: 'deleteProperty', property: property, 
                                    isValid: isValid, validatorDetails: validatorDetails
                                }}))
                            } 
                            return returnValue
                        }
                    }
                })
                const shadowRoot = this.shadowRoot || this.attachShadow({mode: 'open'})
                shadowRoot.innerHTML = ''
                const styleNode = document.createElement('style')
                styleNode.innerHTML = Element.stackStyles(this.constructor.__b37TagId)
                shadowRoot.appendChild(styleNode)
                const templateNode = document.createElement('template')
                Element.stackTemplates(this.constructor.__b37TagId).then(innerHTML => {
                    templateNode.innerHTML = innerHTML
                    shadowRoot.appendChild(templateNode.content.cloneNode(true))
                })
                Element.autoload($this)
            }
            static get observedAttributes() {
                return []
            }
            attributeChangedCallback(attrName, oldVal, newVal) {
                this[attrName] = newVal
            }            
            b37ProcessQueuedAttributes() {
                const $this = this
                Object.keys($this.b37QueuedAttributes).filter(k => {
                    return $this.b37QueuedAttributes[k].requires && typeof $this.b37QueuedAttributes[k].requires == 'function' ? $this.b37QueuedAttributes[k].requires() : true
                }).forEach(k => {
                    if ($this.b37QueuedAttributes[k].attribute && $this.b37QueuedAttributes[k].value) {
                        $this.setAttribute($this.b37QueuedAttributes[k].attribute, $this.b37QueuedAttributes[k].value)
                        if (typeof $this.b37QueuedAttributes[k].callback == 'function') {
                            $this.b37QueuedAttributes[k].callback()
                        }
                    }
                    delete $this.b37QueuedAttributes[k]
                })
                if (!Object.keys($this.b37QueuedAttributes).length) {
                    globalThis.clearInterval($this.__b37QueuedAttributeInterval)
                }
            }
            b37AddQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.b37QueuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__b37QueuedAttributeInterval = $this.__b37QueuedAttributeInterval || globalThis.setInterval(function() {
                    $this.b37ProcessQueuedAttributes()
                }, 1000)
            }
        }
    }}
})
export { Element }

