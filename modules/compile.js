const globalNamespace = crypto.randomUUID(), nativeElementsMap = {
    ...Object.fromEntries(['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em', 'figcaption', 'figure', 'footer', 'header',
        'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby', 's', 'samp', 'search', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr'].map(l => [l, 'HTMLElement'])),
    ...Object.fromEntries(['blockquote', 'q'].map(l => [l, 'HTMLQuoteElement'])), ...Object.fromEntries(['col', 'colgroup'].map(l => [l, 'HTMLTableColElement'])),
    ...Object.fromEntries(['del', 'ins'].map(l => [l, 'HTMLModElement'])), ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(l => [l, 'HTMLHeadingElement'])),
    ...Object.fromEntries(['tbody', 'tfoot', 'thead'].map(l => [l, 'HTMLTableSectionElement'])), ...Object.fromEntries(['td', 'th'].map(l => [l, 'HTMLTableCellElement'])),
    ...{
        a: 'HTMLAnchorElement', area: 'HTMLAreaElement', audio: 'HTMLAudioElement', base: 'HTMLBaseElement', body: 'HTMLBodyElement', br: 'HTMLBRElement', button: 'HTMLButtonElement',
        canvas: 'HTMLCanvasElement', caption: 'HTMLTableCaptionElement', data: 'HTMLDataElement', datalist: 'HTMLDataListElement', details: 'HTMLDetailsElement', dialog: 'HTMLDialogElement',
        div: 'HTMLDivElement', dl: 'HTMLDListElement', embed: 'HTMLEmbedElement', fencedframe: 'HTMLFencedFrameElement', fieldset: 'HTMLFieldSetElement', form: 'HTMLFormElement',
        head: 'HTMLHeadElement', hr: 'HTMLHRElement', html: 'HTMLHtmlElement', iframe: 'HTMLIFrameElement', img: 'HTMLImageElement', input: 'HTMLInputElement', label: 'HTMLLabelElement',
        li: 'HTMLLIElement', link: 'HTMLLinkElement', map: 'HTMLMapElement', menu: 'HTMLMenuElement', meta: 'HTMLMetaElement', meter: 'HTMLMeterElement', object: 'HTMLObjectElement',
        ol: 'HTMLOListElement', optgroup: 'HTMLOptGroupElement', option: 'HTMLOptionElement', output: 'HTMLOutputElement', p: 'HTMLParagraphElement', picture: 'HTMLPictureElement',
        portal: 'HTMLPortalElement', pre: 'HTMLPreElement', progress: 'HTMLProgressElement', script: 'HTMLScriptElement', select: 'HTMLSelectElement', slot: 'HTMLSlotElement',
        source: 'HTMLSourceElement', span: 'HTMLSpanElement', style: 'HTMLStyleElement', table: 'HTMLTableElement', template: 'HTMLTemplateElement', textarea: 'HTMLTextAreaElement',
        time: 'HTMLTimeElement', title: 'HTMLTitleElement', tr: 'HTMLTableRowElement', track: 'HTMLTrackElement', ul: 'HTMLUListElement', video: 'HTMLVideoElement'
    }
}, regexp = {
    defaultValue: /\s+\?\?\s+(.+)\s*$/, extends: /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/, label: /^([\@\#]?[a-zA-Z0-9]+[\!\?]?):\s+/,
    directiveHandleMatch: /^([A-Z][A-Z0-9]*)::\s(.*)/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g,
}, module = {
    component: {
        enumerable: true, value: async function (src) {
            const fileFetch = await fetch(this.resolveUrl(src)), container = document.createElement('template')
            if (fileFetch.status >= 400) return
            container.innerHTML = await fileFetch.text()
            const style = container.content.querySelector('style') ?? document.createElement('style'),
                template = container.content.querySelector('template') ?? document.createElement('template'),
                script = container.content.querySelector('script') ?? document.createElement('script'),
                scriptCode = script.textContent.trim() || 'export default class extends E.Component {}',
                className = id.split('/').pop().replace('.html', '').split('').map((c, i) => i === 0 ? c.toUpperCase() : c).join('')
            let extendsId = scriptCode.match(regexp.extends)?.groups?.extends, extendsClass = this.Component,
                extendsStatement = `export default class ${className} extends E.Component {`, native
            if (extendsId == null || (extendsId === 'E.Component')) {
                extendsId = undefined
            } else if (extendsId in nativeElementsMap) {
                native = extendsId
                extendsClass = this.app.components[extendsId] = this.Component
                extendsStatement = `export default class ${className} extends E.app.components['${extendsId}'] {`
            } else {
                if (extendsId) {
                    extendsId = this.resolveUrl(new URL(extendsId, id))
                    extendsClass = this.app.components[extendsId] = this.env.components[extendsId] ?? (await this.modules.compile.component(extendsId))
                    extendsStatement = `export default class ${className} extends E.app.components['${extendsId}'] {`
                }
                style.textContent = [extendsClass.style.textContent, style.textContent].join('\n\n')
                if (template.content.querySelector('template[slot], template[data-target]')) {
                    const extendsTemplate = extendsClass.template.content.cloneNode(true)
                    for (const t of template.content.querySelectorAll('template[slot]')) {
                        const slotName = t.getAttribute('slot'), slot = slotName ? extendsTemplate.querySelector(`slot[name="${slotName}"]`) : extendsTemplate.querySelector('slot:not([name])')
                        if (slot) slot.replaceWith(...t.content.cloneNode(true).children)
                    }
                    for (const t of template.content.querySelectorAll('template[data-target]')) {
                        const { position, target = 'slot' } = t.dataset
                        for (const targetElement of extendsTemplate.querySelectorAll(target)) {
                            const replacers = t.content.cloneNode(true).children
                            switch (position) {
                                case 'before': case 'beforebegin':
                                    targetElement.before(...replacers)
                                    break
                                case 'prepend': case 'afterbegin':
                                    targetElement.prepend(...replacers)
                                    break
                                case 'append': case 'beforeend':
                                    targetElement.append(...replacers)
                                    break
                                case 'after': case 'afterend':
                                    targetElement.after(...replacers)
                                    break
                                default:
                                    targetElement.replaceWith(...replacers)
                            }
                        }
                    }
                    template.content.replaceWith(...extendsTemplate.children)
                }
            }
            const sanitizedScript = scriptCode.replace(regexp.extends, extendsStatement)
            return this.modules.compile.componentFactory({ extends: extendsId, native, script: sanitizedScript, style, template }, id)
        }
    },
    facet: { // optimal
        enumerable: true, value: async function (directives, cid, container) {
            cid ??= await this.modules.compile.digest(directives = (await this.modules.compile.canonicalizeDirectives(directives)))
            const fieldNames = new Set(), cellNames = new Set(), statements = [], targetNames = { cell: cellNames, field: fieldNames, '#': cellNames, '@': fieldNames },
                { dev } = this.modules, { interpreters } = this.env, { regexp: sysRegexp } = this.sys
            let statementIndex = -1
            for (let directive of directives.split(regexp.splitter)) {
                statementIndex++
                let stepIndex = -1, handle, handleMatch
                if (handleMatch = directive.match(regexp.directiveHandleMatch)) [, handle, directive] = handleMatch
                directive = directive.trim()
                const statement = { handle, index: statementIndex, labels: new Set(), steps: [] }
                for (const segment of directive.split(regexp.segmenter)) {
                    if (!segment) continue
                    stepIndex++
                    let handlerExpression = segment, label, defaultExpression
                    const labelMatch = handlerExpression.match(regexp.label)
                    if (labelMatch) {
                        label = labelMatch[1].trim()
                        handlerExpression = handlerExpression.slice(labelMatch[0].length).trim()
                    }
                    const defaultExpressionMatch = handlerExpression.match(regexp.defaultValue)
                    if (defaultExpressionMatch) {
                        defaultExpression = defaultExpressionMatch[1].trim()
                        handlerExpression = handlerExpression.slice(0, defaultExpressionMatch.index).trim()
                        if (defaultExpression.length > 1) switch (defaultExpression[0]) {
                            case '@': fieldNames.add(defaultExpression.slice(1).trim()); break
                            case '#': cellNames.add(defaultExpression.slice(1).trim()); break
                        }
                    }
                    label ||= `${stepIndex}`
                    const labelModeFlag = label[label.length - 1], labelMode = labelModeFlag === '!' ? 'force' : ((labelModeFlag === '?') ? 'silent' : undefined)
                    if (labelMode) {
                        label = label.slice(0, -1).trim()
                        labelMode = labelMode
                    }
                    label = label
                    switch (label[0]) {
                        case '@': case '#':
                            let n = label.slice(1).trim()
                            if (n) (targetNames[label[0]]).add(n)
                            break
                        default:
                            const ln = label.trim()
                            if (ln) statement.labels.add(ln)
                    }
                    let signature
                    for (const [matcher, interpreter] of interpreters) {
                        const { parser, name } = interpreter
                        if (matcher.test(handlerExpression) && (typeof parser === 'function')) {
                            signature = { name, interpreter: matcher.toString(), descriptor: (await parser(handlerExpression)) ?? {}, variables: {} }
                            if (name === 'state') {
                                const { target, shape } = signature.descriptor
                                switch (shape) {
                                    case 'single':
                                        targetNames[target.type].add(target.name)
                                        break
                                    case 'array':
                                        for (const t of target) targetNames[t.type].add(t.name)
                                        break
                                    case 'object':
                                        for (const key in target) targetNames[target[key].type].add(target[key].name)
                                        break
                                }
                            }
                            break
                        }
                    }
                    if (signature === undefined) {
                        if (dev) dev.print(`No matching interpreter is available for the expression at position '${statementIndex}-${stepIndex}' in ${container.id || container.name || container.dataset.facetCid}: ${handlerExpression}`, 'warning')
                        let matcher, name = 'console'
                        for (const [k, v] of interpreters) if (v.name === name) { matcher = k; break }
                        if (!matcher) continue
                        signature = { name, interpreter: 'undefined', descriptor: { verbose: true }, variables: {} }
                    }
                    for (const p in signature.descriptor) if (this.isWrappedVariable(signature.descriptor[p])) signature.variables[p] = true
                    if (Object.keys(signature.variables).length) Object.freeze(signature.variables)
                    else delete signature.variables
                    Object.freeze(signature.descriptor)
                    const step = { label, labelMode, signature: Object.freeze(signature) }
                    if (defaultExpression) step.defaultExpression = defaultExpression
                    statement.labels.add(label)
                    statement.labels.add(`${stepIndex}`)
                    statement.steps.push(Object.freeze(step))
                }
                statement.labels = [...statement.labels]
                Object.seal(statement.labels)
                Object.freeze(statement.steps)
                Object.freeze(statement)
                statements.push(statement)
            }
            return this.modules.compile.facetFactory({ fieldNames, cellNames, statements, cid })
        }
    },
    isValidTag: {
        value: function (tag) {
            return !(document.createElement(tag) instanceof HTMLUnknownElement)
        }
    },
    componentFactory: {
        value: async function (manifest, id) {
            let ComponentClass
            if (manifest.prototype instanceof this.Component) {
                ComponentClass = manifest
            } else {
                if (!this.isPlainObject(manifest)) return
                const { extends: mExtends, native: mNative, script: mScript, style: mStyle, template: mTemplate } = manifest
                let cExtends = mExtends ? ((mNative && mExtends === mNative) ? mExtends : this.resolveUrl(mExtends)) : undefined,
                    native = mNative && (typeof mNative === 'string') && !mNative.includes('-') && this.modules.compile.isValidTag(mNative) ? mNative : undefined,
                    style = mStyle && (typeof mStyle === 'string') ? mStyle : (mStyle instanceof HTMLElement ? mStyle.textContent : ''),
                    template = mTemplate && (typeof mTemplate === 'string') ? mTemplate : (mTemplate instanceof HTMLElement ? mTemplate.innerHTML : ''),
                    script = mScript && (typeof mScript === 'string') ? mScript.replace('export default ', '').trim() : 'class extends E.Component {}',
                    [scriptHead, ...scriptBody] = script.split('{')
                script = `  ${scriptHead} {

        static {
            this.extends = ${cExtends ? ("'" + cExtends + "'") : "undefined"}
            this.native = ${native ? ("'" + native + "'") : "undefined"}
            const styleCss = \`${style}\`, templateHtml = \`${template}\`
            if (styleCss) {
                this.style = document.createElement('style')
                this.style.textContent = styleCss
            }
            if (templateHtml) {
                this.template = document.createElement('template')
                this.template.innerHTML = templateHtml
            }
        }

${scriptBody.join('{')}`

                const classAsModuleUrl = URL.createObjectURL(new Blob([`const E = globalThis['${globalNamespace}']; export default ${script}`], { type: 'text/javascript' }))
                ComponentClass = (await import(classAsModuleUrl)).default
                URL.revokeObjectURL(classAsModuleUrl)
            }
            Object.defineProperty(ComponentClass, 'id', { enumerable: true, value: id })
            Object.defineProperty(ComponentClass, 'E', { value: this })
            Object.defineProperty(ComponentClass.prototype, 'E', { value: this })
            return ComponentClass
        }
    },
    canonicalizeDirectives: { // optimal
        value: async function (directives) {
            directives = directives.trim()
            if (!directives) return 'null'
            const canonicalizedDirectivesMap = {}, canonicalizedDirectives = [], { regexp: sysRegexp } = this.sys, { digest } = this.modules.compile
            for (let directive of directives.split(regexp.splitter)) {
                directive = directive.trim()
                if (!directive || directive.startsWith('|* ')) continue
                directive = directive.replace(regexp.segmenter, ' >> ')
                if (!directive) continue
                canonicalizedDirectivesMap[await digest(directive)] = directive
            }
            for (const directiveDigest of Object.keys(canonicalizedDirectivesMap).sort()) canonicalizedDirectives.push(canonicalizedDirectivesMap[directiveDigest])
            return canonicalizedDirectives.join('\n')
        }
    },
    digest: { // optimal
        value: async function (str) {
            if (typeof str !== 'string') str = String(str)
            const bytes = (new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))), hex = '0123456789abcdef', digest = new Array(bytes.length * 2)
            for (let i = 0, j = 0, l = bytes.length, b; i < l; i++) {
                digest[j++] = hex[(b = bytes[i]) >> 4]
                digest[j++] = hex[b & 15]
            }
            return digest.join('')
        }
    },
    facetFactory: { // optimal
        value: async function (manifest) {
            let FacetClass
            if (manifest.prototype instanceof this.Facet) {
                FacetClass = manifest
            } else {
                if (!this.isPlainObject(manifest)) return
                const { fieldNames = [], cellNames = [], statements = [], cid } = manifest
                if (!cid || (typeof cid !== 'string')) return
                const source = `  class ${cid} extends E.Facet {

        static cid = '${cid}'
        static fieldNames = Object.freeze(${JSON.stringify(Array.from(fieldNames))})
        static cellNames = Object.freeze(${JSON.stringify(Array.from(cellNames))})
        static statements = E.deepFreeze(${JSON.stringify(statements)})

    }`

                const classAsModuleUrl = URL.createObjectURL(new Blob([`const E = globalThis['${globalNamespace}']; export default ${source}`], { type: 'text/javascript' }))
                FacetClass = (await import(classAsModuleUrl)).default
                URL.revokeObjectURL(classAsModuleUrl)
            }
            Object.defineProperty(FacetClass, 'E', { value: this })
            Object.defineProperty(FacetClass.prototype, 'E', { value: this })
            return FacetClass
        }
    },
    getStateGroup: {
        value: function (expression, typeDefault = 'cell', element) {
            const parseOnly = !(element instanceof HTMLElement)
            let group, shape
            if (!parseOnly) element = this.app._components.virtuals.get(element) ?? element
            const canonicalizeName = (name) => {
                let type
                switch (name[0]) {
                    case '@': type = 'field'; break
                    case '#': type = 'cell'; break
                    default: type = typeDefault
                }
                const modeFlag = name[name.length - 1],
                    mode = modeFlag === '!' ? 'force' : ((modeFlag === '?') ? 'silent' : undefined)
                if (mode) name = name.slice(0, -1).trim()
                return { name: name, mode, type }
            }, getStateTarget = parseOnly ? undefined : (name, mode, type) => {
                switch (type) {
                    case 'cell':
                        return { cell: (new this.Cell(name)), type, mode }
                    case 'field':
                        return { field: (new this.Field(name, undefined, element)), type, mode }
                }
            }
            switch (expression[0]) {
                case '{':
                    group = {}
                    shape = 'object'
                    for (const pair of expression.slice(1, -1).trim().split(',')) {
                        let [key, rawName] = pair.trim().split(':').map(s => s.trim())
                        if (!rawName) rawName = key
                        const { name, mode, type } = canonicalizeName(rawName)
                        if (mode) key = key.slice(0, -1)
                        group[key] = { name, mode, type }
                        if (!parseOnly) group[key][type] = getStateTarget(name, mode, type)
                    }
                    break
                case '[':
                    group = []
                    shape = 'array'
                    for (let t of expression.slice(1, -1).split(',')) {
                        t = t.trim()
                        if (!t) continue
                        const { name, mode, type } = canonicalizeName(t), index = group.push({ name, mode, type }) - 1
                        if (!parseOnly) group[index][type] = getStateTarget(name, mode, type)
                    }
                    break
                default:
                    shape = 'single'
                    expression = expression.trim()
                    if (!expression) return
                    group = canonicalizeName(expression)
                    if (!parseOnly) group = getStateTarget(group.name, group.mode, group.type)
            }
            if (parseOnly) return { group, shape }
            return group
        }
    },
    globalNamespace: { value: globalNamespace },
    parsers: {
        value: {
            ai: async function (expression) { // optimal
                const [ai, prompt] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                return { ai, prompt }
            },
            api: async function (expression) { // optimal
                const [api, action] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                return { api, action }
            },
            command: async function (expression) { // optimal
                return { invocation: expression.slice(2, -1).trim() }
            },
            console: async function (expression) { // optimal
                return { verbose: expression === '$?' }
            },
            content: async function (expression) { // optimal
                const [collection, article, lang] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                return { collection, article, lang }
            },
            pattern: async function (expression) { // optimal
                expression = expression.slice(1, -1)
                expression = (expression.endsWith('\\ ')) ? expression.trimStart() : expression.trim()
                expression.replaceAll('\\ ', ' ')
                return { pattern: expression }
            },
            request: async function (expression) { // optimal
                const [url, contentType] = this.expression.slice(1, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
                return { url, contentType }
            },
            router: async function (expression) { // optimal
                return { expression, signal: expression === '#' }
            },
            selector: async function (expression) { // optimal
                return { signal: true, ...(await this.resolveScopedSelector(expression.slice(2, -1))) }
            },
            shape: async function (expression) { // optimal
                return { shape: this.resolveShape(expression) }
            },
            state: async function (expression) { // optimal
                expression = expression.trim()
                const typeDefault = expression[0] === '@' ? 'field' : 'cell'
                expression = expression.slice(1).trim()
                const { group: target, shape } = this.modules.compile.getStateGroup(expression, typeDefault)
                return { signal: true, target, shape }
            },
            transform: async function (expression) { // optimal
                return { transform: expression.slice(1, -1).trim() }
            },
            type: async function (expression) { // optimal
                let mode = 'any', types = []
                expression = expression.slice(1, -1).trim()
                switch (expression[0]) {
                    case '|':
                        if (expression.endsWith('|')) [mode, expression] = ['all', expression.slice(1, -1).trim()]
                        break
                    case '?': if (expression.endsWith('?')) [mode, expression] = ['info', expression.slice(1, -1).trim()]
                }
                for (let typeName of expression.split(',')) {
                    typeName = typeName.trim()
                    if (!typeName) continue
                    const ifMode = typeName[0] !== '!'
                    types.push({ if: ifMode, name: ifMode ? typeName : typeName.slice(1) })
                }
                return { types, mode }
            },
            value: async function (expression) { // optimal
                return { value: expression in this.sys.valueAliases ? this.sys.valueAliases[expression] : JSON.parse(expression) }
            },
            variable: async function (expression) { // optimal
                return { expression: expression.slice(2, -1).trim() }
            },
            wait: async function (expression) { // optimal
                return { expression: expression.slice(1, -1).trim() }
            }
        }
    }
}
export { module }