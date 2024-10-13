export default {
    parseDirectives: async function (directives) {
        const { E } = this, { sys } = E, { regexp } = sys
        directives = directives.trim()
        if (!directives) return
        const targetNames = { cell: E.Cell, field: E.Field, '#': E.Cell, '@': E.Field }, { interpreters } = E.env
        let statementIndex = -1
        for (let directive of directives.split(regexp.splitter)) {
            directive = directive.trim()
            if (!directive || directive.startsWith('|* ')) continue
            statementIndex++
            let stepIndex = -1, handle, handleMatch
            if (handleMatch = directive.match(regexp.directiveHandleMatch)) [, handle, directive] = handleMatch
            directive = directive.trim()
            const statement = { handle, index: statementIndex, labels: {}, steps: [] }
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
                    let name
                    if (defaultExpression.length > 1) switch (defaultExpression[0]) {
                        case '@': new E.Field(defaultExpression.slice(1).trim(), undefined, this); break
                        case '#': new E.Cell(defaultExpression.slice(1).trim()); break
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
                        if (n) new targetNames[label[0]](n, this)
                        break
                    default:
                        const ln = label.trim()
                        if (ln) statement.labels[ln] ??= undefined
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
                                    new targetNames[target.type](target.name, this)
                                    break
                                case 'array':
                                    for (const t of target) new targetNames[t.type](t.name, this)
                                    break
                                case 'object':
                                    for (const key in target) new targetNames[target[key].type](target[key].name, this)
                                    break
                            }
                        }
                        break
                    }
                }
                if (signature === undefined) {
                    if (dev) dev.print(`No matching interpreter is available for the expression at position '${statementIndex}-${stepIndex}' in: ${handlerExpression}`, 'warning')
                    let matcher, name = 'console'
                    for (const [k, v] of interpreters) if (v.name === name) { matcher = k; break }
                    if (!matcher) continue
                    signature = { name, interpreter: 'undefined', descriptor: { verbose: true }, variables: {} }
                }
                for (const p in signature.descriptor) if (E.isWrappedVariable(signature.descriptor[p])) signature.variables[p] = true
                if (Object.keys(signature.variables).length) Object.freeze(signature.variables)
                else delete signature.variables
                Object.freeze(signature.descriptor)
                const step = { label, labelMode, signature: Object.freeze(signature) }
                if (defaultExpression) step.defaultExpression = defaultExpression
                statement.labels[label] ??= undefined
                statement.labels[`${stepIndex}`] ??= undefined
                statement.steps.push(Object.freeze(step))
            }
            Object.seal(statement.labels)
            Object.freeze(statement.steps)
            Object.freeze(statement)
            this.statements.push(statement)
        }
    }
}