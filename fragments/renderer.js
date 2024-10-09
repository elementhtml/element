export default {
    apply: async function (node) {
        const { E } = this.constructor, nodeIsElement = node instanceof HTMLElement, { selectors, name, defaultValue, mode } = this, promises = [],
            modeIsLang = mode === 'lang', envelope = Object.freeze(await E.createEnvelope(this.envelope ?? {}))
        for (const selector in selectors) {
            const nodeList = Array.from(node.querySelectorAll(selector)), { key, token: tokenAttr, target: targetAttr } = selectors[selector]
            if (nodeIsElement && node.matches(selector)) nodeList.push(node)
            for (const n of nodeList) {
                const nodeEnvelope = { ...envelope, labels: { ...n.dataset } }, token = E.resolveVariable(n.getAttribute(tokenAttr), nodeEnvelope, { wrapped: false })
                promises.push(this.engine.run(token, modeIsLang ? (n.closest('[lang]').getAttribute('lang') || undefined) : name, nodeEnvelope).then(tokenValue => {
                    targetAttr ? n.setAttribute(target, tokenValue ?? defaultValue) : (n[key] = (tokenValue ?? defaultValue))
                }))
            }
        }
        return Promise.all(promises)
    },
    run: async function () {
        const { E, validEngineClasses } = this.constructor, { scopeSelector, engine } = this
        if (!engine) return
        if (typeof engine === 'string') {
            const [engineType, engineName] = engine.trim().split(E.sys.regexp.colonSplitter), validEngine = false
            this.engine = await E.resolveUnit(engineName, engineType)
            for (const n of validEngineClasses.keys()) if (validEngine ||= (this.engine instanceof E[n])) break
            if (!validEngine) return
        }
        let nodes
        if (scopeSelector) {
            nodes = Array.from(document.querySelectorAll(scopeSelector))
            if (document.documentElement.matches(scopeSelector)) nodes.push(document.documentElement)
        } else nodes = Array.from(document.getElementsByTagName('*'))
        for (const node of nodes) this.support(node)
    }
}