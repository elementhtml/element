const module = {

    compileComponent: {
        enumerable: true,
        value: async function (tagOrId) {
            let tag, namespace, name, id, isUrl = tagOrId[0] === '/' || tagOrId[0] === '.' || tagOrId.indexOf('/') || tagOrId.indexOf('.') || !tagOrId.indexOf('-')
            if (tagOrId.indexOf('-') && !isUrl) {
                [namespace, ...name] = tag.split('-').map(t => t.toLowerCase()).filter(s => !!s)
                name = name.join('/')
                id = this.env.namespaces[namespace] ? (new URL(`${this.env.namespaces[namespace]}/${name}.html`, document.baseURI)).href
                    : (new URL(`components/${namespace}/${name}.html`, document.baseURI)).href
            } else {
                id = isUrl ? (new URL(tagOrId, document.baseURI)).href : (new URL(`components/${tagOrId}.html`, document.baseURI)).href
            }
            const fileFetch = await fetch(this.resolveUrl(id))
            if (fileFetch.status >= 400) return
            const sourceCode = await fileFetch.text(), styleCode = sourceCode.slice(sourceCode.indexOf('<style>') + 7, sourceCode.indexOf('</style>')).trim(),
                templateCode = sourceCode.slice(sourceCode.indexOf('<template>') + 10, sourceCode.indexOf('</template>')).trim(),
                scriptCode = sourceCode.slice(sourceCode.indexOf('<script>') + 8, sourceCode.indexOf('</script>')).trim(),
                extendsId = scriptCode.match(this.sys.regexp.extends)?.groups?.extends || 'HTMLElement'


            // extendsId can either be a reference to a component within the same namespace, or a URL id of a 'foreign' component

            this.app.components.classes[extendsId] = this.env.components[extendsId] ?? (await this.compileComponent(extendsId))



            const sanitizedScript = scriptCode.replace(this.sys.regexp.extends, `class extends ElementHTML.constructors['${extendsId}'] {`),
                sanitizedScriptAsModule = `const ElementHTML = globalThis['${this.app._globalNamespace}']; export default ${sanitizedScript}`,
                sanitizedScriptAsUrl = URL.createObjectURL(new Blob([sanitizedScriptAsModule], { type: 'text/javascript' })),
                classModule = await import(sanitizedScriptAsUrl)
            URL.revokeObjectURL(sanitizedScriptAsUrl)
            const baseClass = classModule.default

            let ComponentClass, style = document.createElement('style'), template = document.createElement('template')
            style.textContent = styleCode
            template.content.textContent = templateCode

            ComponentClass = class extends baseClass {
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
        enumerable: true,
        value: async function (directives, hash) {
            hash ??= await this.digest(directives = this.canonicalizeDirectives(directives))
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
                    const step = {}, labelMatch = handlerExpression.match(this.sys.regexp.label)
                    if (labelMatch) {
                        label = labelMatch[1].trim()
                        handlerExpression = handlerExpression.slice(labelMatch[0].length).trim()
                    }
                    const defaultExpressionMatch = handlerExpression.match(this.sys.regexp.defaultValue)
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
                                    for (const addedName of (params.ctx.vars.addedFieldNames ?? [])) fieldNames.add(addedName)
                                    for (const addedName of (params.ctx.vars.addedCellNames ?? [])) cellNames.add(addedName)
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
                    statement.labels = Array.from(statement.labels)
                    statement.steps.push(Object.freeze(step))
                }
                Object.seal(statement.labels)
                Object.freeze(statement.steps)
                Object.freeze(statement)
                statements.push(statement)
            }
            return this.facetFactory({ fieldNames, cellNames, statements, hash })
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
                return { handler: 'state', ctx: { binder: true, vars: { expression: expression.slice(1), signal: true, typeDefault: expression[0] } } }
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