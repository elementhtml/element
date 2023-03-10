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
    _extendsRegExp: {configurable: false, enumerable: false, writable: false, 
        value: /class\s+extends\s+`(?<extends>.+)`\s+\{/}, 
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && ((tagName.startsWith('HTML') && tagName.endsWith('Element')) || tagName == 'Image' || tagName == 'Audio')
    }},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function() {
        this._enscapulateNative()
        const observer = new MutationObserver(mutationList => {
            mutationList.forEach(mutationRecord => {
                mutationRecord.addedNodes.forEach(addedNode => {
                    if (addedNode.tagName.includes('-')) {
                        this.activateTag(addedNode.tagName)
                    }
                })
            })
        })
        observer.observe(document, {subtree: true, childList: true, attributes: false})
        Array.from(new Set(Array.from(document.querySelectorAll('*')).filter(element => element.tagName.indexOf('-') > 0).map(element => element.tagName.toLowerCase()))).sort()
            .forEach(async customTag => await this.activateTag(customTag))
    }}, 
    autoloadShadow: {configurable: false, enumerable: true, writable: false, value: async function(element) {
        const observer = new MutationObserver(mutationList => {
            mutationList.forEach(mutationRecord => {
                mutationRecord.addedNodes.forEach(addedNode => {
                    if (addedNode?.tagName?.includes('-')) {
                        this.activateTag(addedNode.tagName)
                    }
                })
            })
        })
        observer.observe(element.shadowRoot, {subtree: true, childList: true, attributes: false})
        Array.from(new Set(Array.from(element.shadowRoot.querySelectorAll('*')).filter(element => element.tagName.indexOf('-') > 0).map(element => element.tagName.toLowerCase()))).sort()
            .forEach(async customTag => await this.activateTag(customTag))
    }}, 
    getInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagId='HTMLElement') {
        let inheritance = [tagId], count = 1000
        while (count && tagId &&  !this._isNative(tagId) && this.extends[tagId]) { 
            inheritance.push(this.extends[tagId])
            tagId = this.extends[tagId] 
            count = count - 1
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
        source.getAttributeNames().filter(a => keep.includes(a) || (autoKeepB37) ? a.startsWith('b37-') : false).forEach(a => {
            const aValue = source.getAttribute(a)
            aValue === '' ? target.toggleAttribute(a, true) : (aValue ? target.setAttribute(a, aValue) : undefined)
        })
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
            const extendsClassAliasGroups = this.scripts[tagId].match(this._extendsRegExp)?.groups, 
                extendsClassAlias = extendsClassAliasGroups ? (extendsClassAliasGroups.extends) : undefined
            let extendsClassId = extendsClassAlias.match(/^[a-z0-9]+-[a-z0-9]+$/) ? this.getTagId(extendsClassAlias) : extendsClassAlias
            if (extendsClassId) {
                extendsClassId = this._isNative(extendsClassId) ? extendsClassId : (new URL(extendsClassId, document.location)).href
                this.extends[tagId] = extendsClassId
                if (!this.files[extendsClassId] && !this._isNative(extendsClassId)) {
                    await this.loadTagAssetsFromId(extendsClassId)
                }            
            }
            let sanitizedScript = this.scripts[tagId].replace(this._extendsRegExp, `class extends Element.constructors['${extendsClassId}'] {`)
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
                $this.__b37QueuedAttributes = {}
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
                                if (value === undefined || value === null) {
                                    return this.deleteProperty(target, property)
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
                                                return false
                                            }
                                        }
                                        Object.keys(propertyRenderer.b37Dataset).forEach(k => !(k in value) ? delete propertyRenderer.b37Dataset[k] : null)
                                        Object.keys(value).forEach(k => propertyRenderer.b37Dataset[k] !== value[k] ? propertyRenderer.b37Dataset[k] = value[k] : null )
                                        return true
                                    } else {
                                        throw new TypeError(`No sub-element found in the shadowRoot with a b37-prop equal to ${property} for this instance of element class ${this.constructor.__b37TagId}`)
                                        return false
                                    }
                                } else {
                                    return !!(target[property] = value)
                                }
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
                            if (property in target) {
                                return delete target[property]
                            } else {
                                const propertyRenderer = $this.shadowRoot.querySelector(`:scope > [b37-prop="${property}"]:not(b37-slot)`)
                                if (propertyRenderer) {
                                    const b37slot = document.createElement('b37-slot')
                                    Element.copyAttributes(propertyRenderer, b37slot, (propertyRenderer.getAttribute('b37-keep') || '').split(' ').filter(a => !!a), true)
                                    propertyElement.replaceWith(b37slot)                                
                                }
                                return true
                            }
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
                Element.autoloadShadow($this)
            }
            static get observedAttributes() {
                return []
            }
            attributeChangedCallback(attrName, oldVal, newVal) {
                this[attrName] = newVal
            }            
            b37ProcessQueuedAttributes() {
                const $this = this
                Object.keys($this.__b37QueuedAttributes).filter(k => {
                    return $this.__b37QueuedAttributes[k].requires && typeof $this.__b37QueuedAttributes[k].requires == 'function' ? $this.__b37QueuedAttributes[k].requires() : true
                }).forEach(k => {
                    if ($this.__b37QueuedAttributes[k].attribute && $this.__b37QueuedAttributes[k].value) {
                        $this.setAttribute($this.__b37QueuedAttributes[k].attribute, $this.__b37QueuedAttributes[k].value)
                        if (typeof $this.__b37QueuedAttributes[k].callback == 'function') {
                            $this.__b37QueuedAttributes[k].callback()
                        }
                    }
                    delete $this.__b37QueuedAttributes[k]
                })
                if (!Object.keys($this.__b37QueuedAttributes).length) {
                    globalThis.clearInterval($this.__b37QueuedAttributeInterval)
                }
            }
            b37AddQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.__b37QueuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__b37QueuedAttributeInterval = $this.__b37QueuedAttributeInterval || globalThis.setInterval(function() {
                    $this.b37ProcessQueuedAttributes()
                }, 1000)
            }
        }
    }}
})
export { Element }

