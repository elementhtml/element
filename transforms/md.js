export default async function (text, serialize) {
    if (!this.app.libraries['text/markdown']) {
        if (this.app.libraries['text/markdown']) return
        this.app.libraries['text/markdown'] ||= new (await import('https://cdn.jsdelivr.net/npm/remarkable@2.0.1/+esm')).Remarkable
        const plugin = md => md.core.ruler.push('html-components', parser(md, {}), { alt: [] }),
            parser = md => {
                return (state) => {
                    let tokens = state.tokens, i = -1
                    while (++i < tokens.length) {
                        const token = tokens[i]
                        for (const child of (token.children ?? [])) {
                            if (child.type !== 'text') return
                            if (this.sys.regexp.isTag.test(child.content)) child.type = 'htmltag'
                        }
                    }
                }
            }
        this.app.libraries['text/markdown'].use(plugin)
        this.app.libraries['text/markdown'].set({ html: true })
    }
    const htmlBlocks = (text.match(this.sys.regexp.htmlBlocks) ?? []).map(b => [crypto.randomUUID(), b]),
        htmlSpans = (text.match(this.sys.regexp.htmlSpans) ?? []).map(b => [crypto.randomUUID(), b])
    for (const [blockId, blockString] of htmlBlocks) text = text.replace(blockString, `<div id="${blockId}"></div>`)
    for (const [spanId, spanString] of htmlSpans) text = text.replace(spanString, `<span id="${spanId}"></span>`)
    text = this.app.libraries['text/markdown'].render(text)
    for (const [spanId, spanString] of htmlSpans) text = text.replace(`<span id="${spanId}"></span>`, spanString.slice(6, -7).trim())
    for (const [blockId, blockString] of htmlBlocks) text = text.replace(`<div id="${blockId}"></div>`, blockString.slice(6, -7).trim())
    return text
}