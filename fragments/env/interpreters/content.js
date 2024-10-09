export default async function (container, position, envelope, value) {
    const { descriptor, variables } = envelope, { collection: a, article: articleSignature, lang: langSignature } = descriptor, wrapped = variables && true,
        valueEnvelope = variables && Object.freeze({ ...envelope, value }),
        collection = await this.resolveUnit(variables?.collection ? this.resolveVariable(a, valueEnvelope, { wrapped }) : a, 'collection')
    if (!collection) return
    const vArticle = variables?.article, article = vArticle ? this.resolveVariable(articleSignature, valueEnvelope, { wrapped }) : articleSignature
    if (vArticle && !article) return
    const lang = variables?.lang ? this.resolveVariable(langSignature, valueEnvelope, { wrapped }) : langSignature
    return collection.run(article, lang ?? container.lang, valueEnvelope)
}