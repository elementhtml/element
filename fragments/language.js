export default {
    preload: async function (langCode) {
        const { virtual = {}, saveVirtual, tokens } = this
        if (virtual.engine instanceof Promise) await virtual.engine
        if (!virtual.engine) return
        const { engine, engineIntent, preload, lang, base } = virtual, engineInputBase = { base, tokens }, envelope = await this.constructor.E.createEnvelope(this.envelope ?? {}), promises = []
        if (langCode) return (lang[langCode] ??= engine.run({ ...engineInputBase, to: langCode }, engineIntent, envelope).then(virtualTokens => saveVirtual(virtualTokens, langCode)))
        if (Array.isArray(preload)) for (const preloadLangCode of preload)
            promises.push(lang[preloadLangCode] ??= engine.run({ ...engineInputBase, to: preloadLangCode }, engineIntent, envelope).then(virtualTokens => saveVirtual(virtualTokens, virtualLangCode)))
        return Promise.all(promises)
    },
    run: async function (token, langCode, envelope) {
        const defaultResult = (this.defaultTokenValue === true ? token : this.defaultTokenValue)
        if (!(token in this.tokens)) return defaultResult
        if (!(this.virtual && langCode)) return this.tokens[token] ?? defaultResult
        const { virtual } = this, { engine, engineIntent, lang, base } = virtual
        if (!(langCode && engine)) return
        const [baseLangCode,] = langCode.split('-')
        lang[langCode] ??= {}
        let langTokens = lang[langCode]
        if (token in langTokens) return langTokens[token] ?? defaultResult
        lang[baseLangCode] ??= {}
        langTokens = lang[baseLangCode]
        if (token in langTokens) return langTokens[token] ?? defaultResult
        if (virtual.preload) {
            await Promise.resolve(this.preload(langCode))
            Object.freeze(langTokens)
            return langTokens[token] ?? defaultResult
        }
        return langTokens[token] ??= await this.engine.run({ token, tokenValue: this.tokens[token], from: base, to: langCode }, engineIntent, envelope)
    }
}