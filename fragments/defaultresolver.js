const autoResolverSuffixes = Object.freeze({
    ai: ['js', 'json'], api: ['js', 'json'], collection: ['js', 'json'], content: ['md', 'html', 'txt', 'js'], context: ['json', 'js'], facet: ['directives', 'js'],
    gateway: ['js'], hook: ['js'], interpreter: ['js'], model: ['json', 'jsonl', 'js'], language: ['json', 'js'],
    pattern: ['txt', 'js'], renderer: ['js'], resolver: ['js'], snippet: ['html', 'js'], transform: ['js'], type: ['js', 'schema.json', 'json', 'x', 'xdr']
})

export default async function (unitKey, unitType) {
    if (!(unitKey && unitType)) return
    const unitTypeCollectionName = this.sys.unitTypeMap[unitType]?.[0]
    if (!unitTypeCollectionName) return
    let unitUrl
    switch (unitKey[0]) {
        case '.': case '/': unitUrl = this.resolveUrl(unitKey, undefined, true); break
        case '~': unitUrl = this.resolveUrl(`/${unitTypeCollectionName}/${unitKey.slice(1)}`, undefined, true); break
        default:
            if (unitKey.includes('://')) try { unitUrl = this.resolveUrl(new URL(unitKey).href, undefined, true) } catch (e) { }
            else unitUrl = this.resolveUrl(`${unitTypeCollectionName}/${unitKey}`, undefined, true)
    }
    if (!unitUrl) return
    let unitSuffix
    try { if (!this.app._failedHrefs.has(unitUrl.href) && (await fetch(unitUrl.href, { method: 'HEAD' })).ok) unitSuffix = true } catch (e) { this.app._failedHrefs.add(unitUrl.href) }
    if (!unitSuffix) for (const s of (autoResolverSuffixes[unitType] ?? [])) {
        if (unitUrl.pathname.endsWith(`.${s}`)) { unitSuffix = s; break }
        const testPath = `${unitUrl.pathname}.${s}`, testUrl = `${unitUrl.protocol}//${unitUrl.host}${testPath}`
        if (this.app._failedHrefs.has(testUrl)) continue
        try {
            if ((await fetch(testUrl, { method: 'HEAD' })).ok) {
                unitUrl.pathname = testPath
                unitSuffix = s
                break
            }
        } catch (e) { this.app._failedHrefs.add(testUrl) }
    }
    if (!unitSuffix) return
    let unitModule, unit
    if (unitUrl) {
        switch (unitSuffix) {
            case 'js': case 'wasm': unit = this.resolveImport(unitUrl.href); break
            case 'json':
                unitModule = await (await fetch(unitUrl.href)).json()
            default:
                if (!unitModule) unitModule = (await this.parse(unitModule = (await fetch(unitUrl.href)))) ?? (await unitModule.text())
                const { hash } = unitUrl
                unit = hash ? ((unit && typeof unit === 'object') ? unit[hash] : undefined) : unitModule
        }
    }
    const [, unitClassName] = this.sys.unitTypeMap[unitType], unitClass = typeof unitClassName === 'string' ? this[unitClassName] : unitClassName
    if (unit instanceof unitClass) return unit
    if (typeof unit === 'function') unit = await unit(this)
    if (unit instanceof unitClass) return unit
    return new unitClass(unit)
}
