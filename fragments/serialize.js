export default async function (input, contentType) {
    contentType ||= 'application/json'
    if (typeof input === 'string') return input
    if (contentType && !contentType.includes('/')) contentType = `application/${contentType}`
    if (contentType === 'application/json') try { return JSON.stringify(input) } catch (e) { return }
    if ((input instanceof HTMLElement) && (contentType === 'text/html' || contentType === 'text/markdown')) input = input.outerHTML
    if (contentType && contentType.includes('form')) return (new URLSearchParams(input)).toString()
    if (contentType === 'text/css') {
        if (input instanceof HTMLElement) return (await (new CSSStyleSheet()).replace(input.textContent)).cssRules.map(rule => rule.cssText).join('\n')
        if (input instanceof CSSStyleSheet) return input.cssRules.map(rule => rule.cssText).join('\n')
    }
    return (await this.resolveUnit(contentType, 'transform'))?.run(input)
}