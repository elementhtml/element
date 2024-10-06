export default (E) => {
    return new E.transform(async (text, envelope) => {
        const lib = E.app.libraries['text/markdown']
        if (!lib) {
            lib = await E.resolveUnit('md', 'library')

            const plugin = md => md.core.ruler.push('html-components', parser(md, {}), { alt: [] }),
                parser = md => {
                    return (state) => {
                        let tokens = state.tokens, i = -1
                        while (++i < tokens.length) {
                            const token = tokens[i]
                            for (const child of (token.children ?? [])) {
                                if (child.type !== 'text') return
                                if (E.sys.regexp.isTag.test(child.content)) child.type = 'htmltag'
                            }
                        }
                    }
                }
            lib.use(plugin)
            lib.set({ html: true })
        }
        const htmlBlocks = (text.match(E.sys.regexp.htmlBlocks) ?? []).map(b => [crypto.randomUUID(), b]),
            htmlSpans = (text.match(E.sys.regexp.htmlSpans) ?? []).map(b => [crypto.randomUUID(), b])
        for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
        for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
        text = lib.render(text)
        for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
        for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
        return text
    })
}
