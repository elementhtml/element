export default async function (text) {
    this.app.libraries['application/x-jsonata'] ??= (await import('https://cdn.jsdelivr.net/npm/jsonata@2.0.3/+esm')).default
    const expression = this.app.libraries['application/x-jsonata'](text)
    let helperName
    for (const matches of text.matchAll(this.sys.regexp.jsonataHelpers)) if (((helperName = matches[1]) in this.app.helpers) || (helperName in this.env.helpers)) expression.registerFunction(helperName, (...args) => this.useHelper(helperName, ...args))
    return expression
}