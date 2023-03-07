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

    traverseSelectorTemplate: {configurable: false, enumerable: true, writable: true, value: '[name="$B37"]'}, 
    traverseSelectorToken: {configurable: false, enumerable: true, writable: true, value: '\\$B37'}, 
    traverseLabelAttribute: {configurable: false, enumerable: true, writable: true, value: undefined}, 
    traverseResultFlatten: {configurable: false, enumerable: true, writable: true, value: false}, 
    traverseDom: {configurable: false, enumerable: true, writable: true, value: 'shadowRoot'}, 

    _extendsRegExp: {configurable: false, enumerable: false, writable: false, 
        value: /class\s+extends\s+`(?<extends>.+)`\s+\{/}, 
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && ((tagName.startsWith('HTML') && tagName.endsWith('Element')) || tagName == 'Image' || tagName == 'Audio')
    }},

/*    _addToTraversalResult: {configurable: false, enumerable: false, writable: false, value: function(methodString, traverseLabelAttribute, keyResult, result, resultObj, a, qs) {
        if (traverseLabelAttribute) {
            if (traverseLabelAttribute == '#innerHTML') {
                keyResult.filter(r => r.innerHTML).forEach(r => resultObj[r.innerHTML] = r[methodString](...a[qs]))
            } else if (traverseLabelAttribute == '#innerText') {
                keyResult.filter(r => r.innerText).forEach(r => resultObj[r.innerText] = r[methodString](...a[qs]))
            } else {
                keyResult.filter(r => r.getAttribute(traverseLabelAttribute)).forEach(r => resultObj[r.getAttribute(traverseLabelAttribute)] = r[methodString](...a[qs]))
            }
        } else {
            result.push(...keyResult.map(n => n[methodString](...a)))
        }
    }},
    _runSingleTraversal: {configurable: false, enumerable: false, writable: false, value: function(singleMethodString, pluralMethodString, attr, traverseDom, traverseLabelAttribute, traverseSelectorTemplate, 
        traverseSelectorTokenRegExp, elem) {
        if (attr && typeof attr == 'object' && Object.keys(attr).length == 1) {

            return Object.assign({}, ...Object.keys(attr).map(qs => {
                const result = [], resultObj = {}
                let keyResult
                if (!traverseDom || traverseDom == '#shadowRoot') {
                    keyResult = Array.from(elem.shadowRoot.querySelectorAll(`:scope > ${traverseSelectorTemplate.replace(traverseSelectorTokenRegExp, qs)}`))
                    Element._addToTraversalResult(pluralMethodString, traverseLabelAttribute, keyResult, result, resultObj, attr[qs], qs)
                } 
                keyResult = (!traverseDom || traverseDom == '#innerHTML') 
                    ? Array.from(elem.querySelectorAll(`:scope > ${traverseSelectorTemplate.replace(traverseSelectorTokenRegExp, qs)}`))
                    : Array.from(elem.querySelectorAll(`:scope > ${traverseSelectorTemplate.replace(traverseSelectorTokenRegExp, qs)}`)).filter(n => n.assignedSlot == traverseDom)
                Element._addToTraversalResult(pluralMethodString, traverseLabelAttribute, keyResult, result, resultObj, attr[qs], qs)
                return {[qs]: traverseLabelAttribute ? resultObj : result}
            }))


        } else {
            return {[attr]: elem[singleMethodString](...Array.from(attr))} 
        }
    }},
*/


    _buildTraversalOptions: {configurable: false, enumerable: false, writable: false, value: function(elem, inheritedOptions={}) {
        inheritedOptions = (inheritedOptions && typeof inheritedOptions == 'object') ? inheritedOptions : {}
        const options = {
            traverseSelectorTemplate: inheritedOptions.traverseSelectorTemplate ?? (elem.closest('[b37-traverse-selector-template]') ?? elem).getAttribute('b37-traverse-selector-template') ?? this.traverseSelectorTemplate ?? '[name="$B37"]', 
            traverseSelectorToken: inheritedOptions.traverseSelectorToken ?? (elem.closest('[b37-traverse-selector-token]') ?? elem).getAttribute('b37-traverse-selector-token') ?? this.traverseSelectorToken ?? '$B37', 
            traverseLabelAttribute: inheritedOptions.traverseLabelAttribute ?? (elem.closest('[b37-traverse-label-attribute]') ?? elem).getAttribute('b37-traverse-label-attribute') ?? this.traverseLabelAttribute, 
            traverseResultFlatten: inheritedOptions.traverseResultFlatten ?? (elem.closest('[b37-traverse-result-flatten]') ?? elem).getAttribute('b37-traverse-result-flatten') ?? this.traverseResultFlatten, 
            traverseDom: inheritedOptions.traverseDom ?? (elem.closest('[b37-traverse-dom]') ?? elem).getAttribute('b37-traverse-dom') ?? this.traverseDom ?? 'shadowRoot'
        }
        options.traverseSelectorTokenRegExp = (inheritedOptions.traverseSelectorToken != options.traverseSelectorToken) 
            ? new RegExp(options.traverseSelectorToken ?? '', 'g') : inheritedOptions.traverseSelectorTokenRegExp
        return options
    }},
    _runTraversal: {configurable: false, enumerable: false, writable: false, value: function(elem, attributesMap, singleMethodString, pluralMethodString, options) {
        if (attributesMap && typeof attributesMap == 'object') {
            const result = {}
            Object.entries(attributesMap).forEach(attrPair => {
                const [attrName, attrParams] = attrPair
                if (Array.isArray(attrParams)) {
                    result[attrName] = elem[singleMethodString](attrName, ...attrParams)
                } else if (attrParams && typeof attrParams == 'object') {
                    const useDom = options.traverseDom == 'shadowRoot' ? elem.shadowRoot : elem, 
                        subElemsSelector = options.traverseSelectorTemplate.replace(options.traverseSelectorTokenRegExp, attrName)
                    let subElems = Array.from(useDom.querySelectorAll(subElemsSelector))
                    if (options.traverseDom && (options.traverseDom != 'shadowRoot') && (options.traverseDom != 'innerHTML')) {
                        subElems = subElems.filter(se => se.assignedSlot && se.assignedSlot?.name == options.traverseDom)
                    }
                    result[attrName] = subElems.map(subElem => {
                        return this._runTraversal(subElem, attrParams, singleMethodString, pluralMethodString, this._buildTraversalOptions(subElem, {...options}))
                    })
                    if (options.traverseResultFlatten && result[attrName].length == 1) {
                        result[attrName] = result[attrName][0]
                    }
                }
            })
            return result
        }
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
        return this.getInheritance(tagId).reverse().filter(tId => !this._isNative(tId)).map(tId => `/** ${tId} styles */\n\n` + this.styles[tId]).join("\n\n\n")
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
            this.constructors[tagId] = class extends this.classes[tagId] {
                __b37tagId = tagId
                constructor() {
                    super()
                    this.abc = 123
                    this.constructor.def = 456
                    const shadowRoot = this.shadowRoot || this.attachShadow({mode: 'open'})
                    shadowRoot.innerHTML = ''
                    const styleNode = document.createElement('style')
                    styleNode.innerHTML = Element.stackStyles(tagId)
                    shadowRoot.appendChild(styleNode)
                    const templateNode = document.createElement('template')
                    Element.stackTemplates(tagId).then(innerHTML => {
                        templateNode.innerHTML = innerHTML
                        shadowRoot.appendChild(templateNode.content.cloneNode(true))
                    })
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
                const $this = this, attributeFilter = [...$this.constructor.observedAttributes]
                Object.defineProperty($this, '__b37dict', {configurable: false, enumerable: false, value: {}})
                ;($this.constructor.observedAttributes || []).forEach(attrName => {
                    const canonicalAttrName = attrName.toLowerCase(), setterFunc = (typeof $this[attrName] === 'function') ? $this[attrName] : undefined
                    if (!attributeFilter.includes(canonicalAttrName)) {
                        attributeFilter.push(canonicalAttrName)
                    }
                    delete $this[attrName]
                    Object.defineProperty($this, attrName, {configurable: false, enumerable: true, set: (value) => {
                        $this.__b37dict[canonicalAttrName] = setterFunc ? setterFunc($this, value) : value
                        if (['string', 'number', 'boolean'].includes(typeof $this.__b37dict[canonicalAttrName])) {
                            const newAttributeValue = $this.__b37dict[canonicalAttrName], currentAttributeValue = $this.hasAttribute(canonicalAttrName) ? $this.getAttribute(canonicalAttrName) 
                                : ($this.hasAttribute(attrName) ? $this.getAttribute(attrName) : null) 
                            if (String(currentAttributeValue) != String(newAttributeValue)) {
                                $this.setAttribute(canonicalAttrName, String(newAttributeValue))
                            }
                        } else {
                            $this.removeAttribute(canonicalAttrName)
                        }
                    }, get: () => {
                        if (canonicalAttrName in $this.__b37dict) {
                            return $this.__b37dict[canonicalAttrName]
                        } else {
                            try {
                                $this[attrName] = $this.getAttribute(canonicalAttrName) ?? $this.getAttribute(attrName) ?? undefined
                            } catch(e) {
                                $this.__b37dict[canonicalAttrName] = $this.getAttribute(canonicalAttrName) ?? $this.getAttribute(attrName) ?? undefined
                            }
                            return $this.__b37dict[canonicalAttrName]
                        }
                    } })
                    if (canonicalAttrName != attrName) {
                        Object.defineProperty($this, canonicalAttrName, {configurable: false, enumerable: false, set: (value) => {
                            $this[attrName] = value
                        }, get: () => $this[attrName] })
                    }
                })
                ;($this.constructor.b37js || []).forEach(src => {
                    const tag = document.querySelector(`script[src="${src}"]`)
                    if (!tag) {
                        tag = document.createElement('script')
                        tag.setAttribute('src', src)
                        document.body.append(tag)
                    }
                })
                ;($this.constructor.b37css || []).forEach(href => {
                    const tag = document.querySelector(`link[rel="stylesheet"][href="${href}"]`)
                    if (!tag) {
                        tag = document.createElement('link')
                        tag.setAttribute('rel', 'stylesheet')
                        tag.setAttribute('href', href)
                        document.head.append(tag)
                    }
                })
                $this.__b37queuedAttributes = {}
                const observer = new MutationObserver(mutationList => {
                    mutationList.forEach(mutationRecord => {
                        if (String($this[mutationRecord.attributeName]) != $this.getAttribute(mutationRecord.attributeName)) {
                            $this[mutationRecord.attributeName] = $this.getAttribute(mutationRecord.attributeName)
                        }
                    })
                })
                observer.observe($this, {subtree: false, childList: false, attributes: true, attributeFilter: attributeFilter, attributeOldValue: true})
            }
            b37processQueuedAttributes() {
                const $this = this
                Object.keys($this.__b37queuedAttributes).filter(k => {
                    return $this.__b37queuedAttributes[k].requires && typeof $this.__b37queuedAttributes[k].requires == 'function' ? $this.__b37queuedAttributes[k].requires() : true
                }).forEach(k => {
                    if ($this.__b37queuedAttributes[k].attribute && $this.__b37queuedAttributes[k].value) {
                        $this.setAttribute($this.__b37queuedAttributes[k].attribute, $this.__b37queuedAttributes[k].value)
                        if (typeof $this.__b37queuedAttributes[k].callback == 'function') {
                            $this.__b37queuedAttributes[k].callback()
                        }
                    }
                    delete $this.__b37queuedAttributes[k]
                })
                if (!Object.keys($this.__b37queuedAttributes).length) {
                    globalThis.clearInterval($this.__b37queuedAttributeInterval)
                }
            }
            b37addQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.__b37queuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__b37queuedAttributeInterval = $this.__b37queuedAttributeInterval || globalThis.setInterval(function() {
                    $this.b37processQueuedAttributes()
                }, 1000)
            }
            static get observedAttributes() {
                return []
            }
            attributeChangedCallback(attrName, oldVal, newVal) {
                this[attrName] = newVal
            }

            b37hasAttributes(attributesMap) {
                return Element._runTraversal(this, attributesMap, 'hasAttribute', 'b37hasAttributes', Element._buildTraversalOptions(this))
            }
            b37getAttributes(attributesMap) {
                return Element._runTraversal(this, attributesMap, 'getAttribute', 'b37getAttributes', Element._buildTraversalOptions(this))
            }
            b37removeAttributes(attributesMap) {
                return Element._runTraversal(this, attributesMap, 'removeAttribute', 'b37removeAttributes', Element._buildTraversalOptions(this))
            }
            b37toggleAttributes(attributesMap) {
                return Element._runTraversal(this, attributesMap, 'toggleAttribute', 'b37toggleAttributes', Element._buildTraversalOptions(this))
            }
            b37setAttributes(attributesMap) {
                return Element._runTraversal(this, attributesMap, 'setAttribute', 'b37setAttributes', Element._buildTraversalOptions(this))
            }

        }
    }}
})
export { Element }