const nativeElementsMap = {
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
}, module = {
    component: {
        enumerable: true, value: async function (id) {
            const fileFetch = await fetch(this.resolveUrl(id)), container = document.createElement('template')
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
                extendsClass = this.app.components.classes[extendsId] = this.Component
                extendsStatement = `export default class ${className} extends E.app.components.classes['${extendsId}'] {`
            } else {
                if (extendsId) {
                    extendsId = this.resolveUrl(new URL(extendsId, id))
                    extendsClass = this.app.components.classes[extendsId] = this.env.components[extendsId] ?? (await this.modules.compile.component(extendsId))
                    extendsStatement = `export default class ${className} extends E.app.components.classes['${extendsId}'] {`
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
            return this.componentFactory({ extends: extendsId, native, script: sanitizedScript, style, template }, id)
        }
    },
    facet: {
        enumerable: true, value: async function (directives, cid) {
            cid ??= await this.modules.compile.cid(directives = (await this.modules.compile?.canonicalizeDirectives(directives)))
            const fieldNames = new Set(), cellNames = new Set(), statements = []
            let index = -1
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                index = index + 1
                let handle, handleMatch
                if (handleMatch = directive.match(/^([A-Z][A-Z0-9]*)::\s(.*)/)) [, handle, directive] = handleMatch
                const statement = { handle, index, labels: new Set(), steps: [] }
                let stepIndex = -1
                for (let [index, segment] of directive.split(' >> ').entries()) {
                    segment = segment.trim()
                    if (!segment) continue
                    let handlerExpression = segment, label, defaultExpression, hasDefault = false
                    const step = {}, labelMatch = handlerExpression.match(regexp.label)
                    if (labelMatch) {
                        label = labelMatch[1].trim()
                        handlerExpression = handlerExpression.slice(labelMatch[0].length).trim()
                    }
                    const defaultExpressionMatch = handlerExpression.match(regexp.defaultValue)
                    if (defaultExpressionMatch) {
                        defaultExpression = defaultExpressionMatch[1].trim()
                        handlerExpression = handlerExpression.slice(0, defaultExpressionMatch.index).trim()
                        hasDefault = !!defaultExpression
                        if (defaultExpression[0] === '#') {
                            const cn = defaultExpression.slice(1).trim()
                            if (cn) cellNames.add(cn)
                        }
                    }
                    label ||= `${index}`
                    const labelModeFlag = label[label.length - 1], labelMode = labelModeFlag === '!' ? 'force' : ((labelModeFlag === '?') ? 'silent' : undefined)
                    if (labelMode) {
                        label = label.slice(0, -1).trim()
                        step.labelMode = labelMode
                    }
                    step.label = label
                    switch (label[0]) {
                        case '@':
                            let fn = label.slice(1).trim()
                            if (fn) fieldNames.add(fn)
                            break
                        case '#':
                            const cn = label.slice(1).trim()
                            if (cn) cellNames.add(cn)
                            break
                        default:
                            const ln = label.trim()
                            if (ln) statement.labels.add(ln)
                    }
                    let params
                    stepIndex = stepIndex + 1
                    for (const [matcher, interpreter] of this.app.interpreters) if (matcher.test(handlerExpression) && (typeof interpreter.parser === 'function')) {
                        params = interpreter.parser(handlerExpression, hasDefault)
                        if (interpreter.name === 'state') {
                            const { target, shape } = params.ctx.vars, targetNames = { cell: cellNames, field: fieldNames }
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
                    params ??= this.modules.compile.parsers.x(handlerExpression, hasDefault)
                    step.params = params
                    if (defaultExpression) step.defaultExpression = defaultExpression
                    statement.labels.add(label)
                    statement.labels.add(`${index}`)
                    statement.steps.push(Object.freeze(step))
                }
                statement.labels = Array.from(statement.labels)
                Object.seal(statement.labels)
                Object.freeze(statement.steps)
                Object.freeze(statement)
                statements.push(statement)
            }
            return this.facetFactory({ fieldNames, cellNames, statements, cid })
        }
    },
    canonicalizeDirectives: {
        value: async function (directives) {
            directives = directives.trim()
            if (!directives) return 'null'
            const canonicalizedDirectivesMap = {}, canonicalizedDirectives = []
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                directive = directive.trim()
                if (!directive || (directive.slice(0, 3) === '|* ')) continue
                directive = directive.replace(this.sys.regexp.segmenter, ' >> ').trim()
                if (!directive) continue
                canonicalizedDirectivesMap[await this.modules.compile.digest(directive)] = directive
            }
            for (const directiveDigest of Object.keys(canonicalizedDirectivesMap).sort()) canonicalizedDirectives.push(canonicalizedDirectivesMap[directiveDigest])
            return canonicalizedDirectives.join('\n').trim()
        }
    },
    cid: {
        value: async function (data) {
            if (typeof data === 'string') data = (new TextEncoder()).encode(data)
            return `b${this.modules.compile.toBase32(new Uint8Array([0x01, 0x55, ...(new Uint8Array([0x12, 0x20, ...(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))]))]))}`
        }
    },
    digest: {
        value: async function (str) {
            if (typeof str !== 'string') str = `${str}`
            return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))).map(b => b.toString(16).padStart(2, '0')).join('')
        }
    },
    getStateGroup: {
        value: function (expression, typeDefault = 'cell', element) {
            const parseOnly = !(element instanceof HTMLElement)
            let group, shape
            if (!parseOnly) element = this.app.components.virtuals.get(element) ?? element
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
    toBase32: {
        value: function (buffer) {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz234567', size = buffer.length
            let [bits, value, output] = [0, 0, '']
            for (let i = 0; i < size; i++) {
                value = (value << 8) | buffer[i]
                bits += 8
                while (bits >= 5) output += alphabet[(value >>> (bits -= 5)) & 31]
            }
            if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]
            return output
        }
    },
    parsers: {
        value: {
            command: function (expression, hasDefault) {
                return { handler: 'command', ctx: { vars: { invocation: expression.trim() } } }
            },
            console: function (expression, hasDefault) {
                return { handler: 'console', ctx: { vars: { verbose: expression === '$?' } } }
            },
            network: function (expression, hasDefault) {
                const expressionIncludesVariable = (expression.includes('${}') || expression.includes('${$}'))
                let returnFullRequest = false
                if (expression[0] === '~' && expression.endsWith('~')) {
                    returnFullRequest = true
                    expression = expression.slice(1, -1)
                }
                return { handler: 'network', ctx: { vars: { expression, expressionIncludesVariable, hasDefault, returnFullRequest } } }
            },
            pattern: function (expression, hasDefault) {
                expression = expression.trim()
                if (!expression) return
                return { handler: 'pattern', ctx: { binder: true, vars: { expression, regexp: new RegExp(this.env.regexp[expression] ?? expression) } } }
            },
            proxy: function (expression, hasDefault) {
                const [parentExpression, childExpression] = expression.split('.').map(s => s.trim())
                if (!parentExpression || (childExpression === '')) return
                let [parentObjectName, ...parentArgs] = parentExpression.split('(').map(s => s.trim())
                parentArgs = parentArgs.join('(').slice(0, -1).trim().split(',').map(s => s.trim())
                let useHelper = parentObjectName[0] === '~', childMethodName, childArgs
                if (useHelper) {
                    parentObjectName = parentObjectName.slice(1)
                } else {
                    [childMethodName, ...childArgs] = childExpression.split('(').map(s => s.trim())
                    childArgs = childArgs.join('(').slice(0, -1).trim().split(',').map(s => s.trim())
                }
                return { handler: 'proxy', ctx: { binder: true, vars: { childArgs, childMethodName, parentArgs, parentObjectName, useHelper } } }
            },
            router: function (expression, hasDefault) {
                let handler
                switch (expression) {
                    case '#':
                        return { handler: 'routerhash', ctx: { binder: true, signal: true } }
                        break
                    case '?':
                        handler = 'routersearch'
                        break
                    case '/':
                        handler = 'routerpathname'
                        break
                    case ':':
                        handler = 'router'
                }
                return { handler }
            },
            selector: function (expression, hasDefault) {
                if (!expression.includes('|')) {
                    switch (expression[0]) {
                        case '#':
                            expression = `html|${expression}`
                            break
                        case '@':
                            expression = `*|[name="${expression.slice(1)}"]`
                            break
                        case '%':
                            expression = `*|[style~="${expression.slice(1)}"]`
                            break
                        case '~':
                            expression = `*|[itemscope] [itemprop="${expression.slice(1)}"]`
                            break
                        case '.':
                        default:
                            expression = `*|${expression}`
                    }
                }
                const [scope, selector] = expression.split('|').map(s => s.trim())
                return { handler: 'selector', ctx: { binder: true, signal: true, vars: { scope, selector } } }
            },
            shape: function (expression, hasDefault) {
                const shape = this.resolveShape(expression)
                return { handler: 'shape', ctx: { vars: { shape } } }
            },
            state: function (expression, hasDefault) {
                expression = expression.trim()
                const typeDefault = expression[0] === '@' ? 'field' : 'cell'
                expression = expression.slice(1)
                const { group: target, shape } = this.modules.compile.getStateGroup(expression, typeDefault)
                return { handler: 'state', ctx: { binder: true, signal: true, vars: { target, shape } } }
            },
            transform: function (expression, hasDefault) {
                if (expression && expression.startsWith('(`') && expression.endsWith('`)')) expression = expression.slice(1, -1)
                return { handler: 'transform', ctx: { vars: { expression } } }
            },
            type: function (expression, hasDefault) {
                let mode = 'any', types = []
                switch (expression[0]) {
                    case '|':
                        if (expression.endsWith('|')) [mode, expression] = ['all', expression.slice(1, -1).trim()]
                        break
                    case '?':
                        if (expression.endsWith('?')) [mode, expression] = ['info', expression.slice(1, -1).trim()]
                }
                for (let typeName of expression.split(',')) {
                    typeName = typeName.trim()
                    if (!typeName) continue
                    const ifMode = typeName[0] !== '!'
                    types.push({ if: ifMode, name: ifMode ? typeName : typeName.slice(1) })
                }
                return { handler: 'type', ctx: { vars: { types, mode } } }
            },
            value: function (expression, hasDefault) {
                const value = expression in this.sys.valueAliases ? this.sys.valueAliases[expression] : JSON.parse(expression)
                return { handler: 'value', ctx: { vars: { value } } }
            },
            variable: function (expression, hasDefault) {
                return { handler: 'variable', ctx: { vars: { expression } } }
            },
            wait: function (expression, hasDefault) {
                return { handler: 'wait', ctx: { vars: { expression } } }
            },
            x: function (expression, hasDefault) {
                return { handler: 'x', ctx: { vars: { expression, hasDefault } } }
            }
        }
    }
}
export { module }