export default {
    run: async function (slug, lang, envelope) {
        if (typeof slug === 'string') {
            slug = this.constructor.E.resolveVariable(slug, envelope, { merge: true })
            if (lang && typeof lang === 'string') slug = `${E.resolveVariable(lang, envelope, { merge: true })}/${slug}`
        }
        return this.engine(slug, envelope)
    }
}