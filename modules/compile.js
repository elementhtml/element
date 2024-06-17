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
}

const module = {
    compileComponent: {
        enumerable: true, value: async function (id) {
            const fileFetch = await fetch(this.resolveUrl(id)), container = document.createElement('template')
            if (fileFetch.status >= 400) return
            container.innerHTML = await fileFetch.text()
            const style = container.content.querySelector('style'), template = container.content.querySelector('template'), script = container.content.querySelector('script'),
                scriptCode = script.textContent.trim()
            let extendsId = scriptCode.match(regexp.extends)?.groups?.extends || 'HTMLElement', extendsClass = this.Component,
                extendsStatement = `class extends ElementHTML.Component {`
            if (extendsId in nativeElementsMap) {
                extendsClass = this.app.components.classes[extendsId] = this.Component
                extendsStatement = `class extends ElementHTML.app.components.classes.${extendsId} {`
            } else {
                extendsId = this.resolveUrl(new URL(extendsId, id))
                extendsClass = this.app.components.classes[extendsId] = this.env.components[extendsId] ?? (await this.compileComponent(extendsId))
                extendsStatement = `class extends ElementHTML.app.components.classes['${extendsId}'] {`
                style.textContent = [extendsClass.style.textContent, style.textContent].join('\n\n')
                if (template.content.querySelector('template[data-slot], template[data-target]')) {
                    const extendsTemplate = extendsClass.template.content.cloneNode(true)
                    for (const t of template.content.querySelectorAll('template[data-slot]')) {
                        const slotName = t.dataset.slot, slot = slotName ? extendsTemplate.querySelector(`slot[name="${slotName}"]`) : extendsTemplate.querySelector('slot:not([name])')
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
            const sanitizedScript = scriptCode.replace(extendsRegExp, extendsStatement),
                sanitizedScriptAsModule = `const ElementHTML = globalThis['${this.app._globalNamespace}']; export default ${sanitizedScript}`,
                sanitizedScriptAsUrl = URL.createObjectURL(new Blob([sanitizedScriptAsModule], { type: 'text/javascript' })),
                classModule = await import(sanitizedScriptAsUrl)
            URL.revokeObjectURL(sanitizedScriptAsUrl)
            const ComponentClass = class extends classModule.default {
                static id = id
                static extends = extendsId
                static style = style
                static template = template
            }
            ComponentClass.E = this
            return ComponentClass
        }
    },
    compileFacet: {
        enumerable: true, value: async function (directives, cid) {
            cid ??= await this.cid(directives = this.canonicalizeDirectives(directives))
            const fieldNames = new Set(), cellNames = new Set(), statements = []
            let statementIndex = -1
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                statementIndex = statementIndex + 1
                const statement = { labels: new Set(), steps: [] }
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
                    switch (handlerExpression) {
                        case '#': case '?': case '/': case ':':
                            params = this.parsers.router(handlerExpression, hasDefault)
                            break
                        default:
                            switch (handlerExpression[0]) {
                                case '`':
                                    params = this.parsers.proxy(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case '/':
                                    params = this.parsers.pattern(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case '"': case "'":
                                    params = this.parsers.string(handlerExpression.slice(1, -1), hasDefault)
                                    break
                                case "#": case "@":
                                    params = this.parsers.state(handlerExpression, hasDefault)
                                    for (const n of (params.ctx.vars.names.field ?? [])) fieldNames.add(n)
                                    for (const n of (params.ctx.vars.names.cell ?? [])) cellNames.add(n)
                                    break
                                case "$":
                                    if (handlerExpression[1] === "{") {
                                        params = this.parsers.variable(handlerExpression, hasDefault)
                                    } else if (handlerExpression[1] === "(") {
                                        params = this.parsers.selector(handlerExpression.slice(2, -1), hasDefault)
                                    }
                                    break
                                case "(":
                                    params = this.parsers.transform(handlerExpression, hasDefault)
                                    break
                                case "{": case "[":
                                    params = this.parsers.json(handlerExpression, hasDefault)
                                    break
                                case "n": case "t": case "f": case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "7": case "9":
                                    let t
                                    switch (handlerExpression) {
                                        case 'null': case 'true': case 'false':
                                            t = true
                                        default:
                                            if (t || handlerExpression.match(this.sys.regexp.isNumeric)) params = this.parsers.json(handlerExpression, hasDefault)
                                    }
                                    break
                                case "_":
                                    if (handlerExpression.endsWith('_')) {
                                        params = this.parsers.wait(handlerExpression.slice(1, -1), hasDefault)
                                        break
                                    }
                                case '~':
                                    if (handlerExpression.endsWith('~')) handlerExpression = handlerExpression.slice(1, -1)
                                default:
                                    params = this.parsers.network(handlerExpression, hasDefault)
                            }
                    }
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
        value: function (directives) {
            directives = directives.trim()
            const canonicalizeDirectives = []
            for (let directive of directives.split(this.sys.regexp.splitter)) {
                directive = directive.trim()
                if (!directive || (directive.slice(0, 3) === '|* ')) continue
                canonicalizeDirectives.push(directive.replace(this.sys.regexp.segmenter, ' >> ').trim())
            }
            return canonicalizeDirectives.join('\n').trim()
        }
    },
    cid: {
        value: async function (data) {
            if (typeof data === 'string') data = (new TextEncoder()).encode(data)
            return `b${this.toBase32(new Uint8Array([0x01, 0x55, ...(new Uint8Array([0x12, 0x20, ...(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))]))]))}`
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
            json: function (expression, hasDefault) {
                let value = null
                try { value = JSON.parse(expression) } catch (e) { }
                return { handler: 'json', ctx: { vars: { value } } }
            },
            network: function (expression, hasDefault) {
                const expressionIncludesValueAsVariable = (expression.includes('${}') || expression.includes('${$}'))
                let returnFullRequest = false
                if (expression[0] === '~' && expression.endsWith('~')) {
                    returnFullRequest = true
                    expression = expression.slice(1, -1)
                }
                return { handler: 'network', ctx: { vars: { expression, expressionIncludesValueAsVariable, hasDefault, returnFullRequest } } }
            },
            pattern: function (expression, hasDefault) {
                expression = expression.trim()
                if (!expression) return
                return { handler: 'pattern', ctx: { binder: true, vars: { expression, regexp: this.env.regexp[expression] ?? new RegExp(expression) } } }
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
                        return { handler: 'routerhash', ctx: { binder: true, vars: { signal: true } } }
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
                            expression = `:document|${expression}`
                            break
                        case '@':
                            expression = `:root|[name="${expression.slice(1)}"]`
                            break
                        case '^':
                            expression = `:root|[style~="${expression.slice(1)}"]`
                            break
                        case '~':
                            expression = `:root|[itemscope] [itemprop="${expression.slice(1)}"]`
                            break
                        case '.':
                        default:
                            expression = `:root|${expression}`
                    }
                }
                const [scopeStatement, selectorStatement] = expression.split('|').map(s => s.trim())
                return { handler: 'selector', ctx: { binder: true, vars: { scopeStatement, selectorStatement, signal: true } } }
            },
            state: function (expression, hasDefault) {
                expression = expression.trim()
                const typeDefault = expression[0] === '@' ? 'field' : 'cell'
                expression = expression.slice(1)
                const { group, names } = this.getStateGroup(expression, typeDefault)
                return { handler: 'state', ctx: { binder: true, vars: { names, signal: true, group } } }
            },
            string: function (expression, hasDefault) {
                return { handler: 'string', ctx: { vars: { expression } } }
            },
            transform: function (expression, hasDefault) {
                if (expression && expression.startsWith('(`') && expression.endsWith('`)')) expression = expression.slice(1, -1)
                if (expression.startsWith('`~/')) expression = '`transforms' + expression.slice(2)
                if (expression.endsWith('.`')) expression = expression.slice(0, -1) + 'jsonata`'
                return { handler: 'transform', ctx: { vars: { expression } } }
            },
            variable: function (expression, hasDefault) {
                return { handler: 'variable', ctx: { vars: { expression } } }
            },
            wait: function (expression, hasDefault) {
                return { handler: 'wait', ctx: { vars: { expression } } }
            }
        }
    }
}

export { module }