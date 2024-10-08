export default async function (input, contentType) {
    const inputIsResponse = (input instanceof Response)
    if (!(inputIsResponse || (typeof input === 'text'))) return input
    let inputUrlExtension
    if (!contentType && inputIsResponse) {
        const serverContentType = input.headers.get('Content-Type')
        if (serverContentType !== 'application/octet-stream') contentType = serverContentType || undefined
        if (!contentType) {
            const inputUrlPathname = (new URL(input.url)).pathname, suffix = inputUrlPathname.includes('.') ? inputUrlPathname.split('.').pop() : undefined
            contentType = suffix ? this.sys.suffixContentTypeMap[suffix] : undefined
            if (contentType) inputUrlExtension = suffix
        }
        if (!contentType || (contentType === 'text/html') || (contentType === 'text/plain')) return await input.text()
    }
    if (!contentType) return input
    if (contentType === 'application/json') return (input instanceof Response) ? await input.json() : JSON.parse(input)
    let text = ((input instanceof Response) ? await input.text() : input).trim()
    if (contentType === 'text/css') return await (new CSSStyleSheet()).replace(text)
    if (contentType && contentType.includes('form')) return Object.fromEntries((new URLSearchParams(text)).entries())
    return (this.resolveUnit(contentType, 'transform') ?? (inputUrlExtension ? this.resolveUnit(inputUrlExtension, 'transform') : undefined))?.run(text)
}