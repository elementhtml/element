export default async function (element) {
    if (!(element instanceof HTMLElement)) return
    if (this.isFacetContainer(element)) return await this.unmountFacet(element)
    if (element.children.length) {
        const promises = []
        for (const n of element.children) promises.push(this.unmountElement(n))
        await Promise.all(promises)
    }
    if ((typeof element.disconnectedCallback === 'function') && this.getCustomTag(element)) element.disconnectedCallback()
}