export default async function () {
    if (!(unitKey && unitType)) return
    const unitTypeCollectionName = this.sys.unitTypeMap[unitType]?.[0]
    if (!unitTypeCollectionName) return
    let unitUrl
    switch (unitKey[0]) {
        case '.': case '/': unitUrl = this.resolveUrl(unitKey, undefined, true); break
        default:
            if (unitKey.includes('://')) try { unitUrl = this.resolveUrl(new URL(unitKey).href, undefined, true) } catch (e) { }
            else unitUrl = this.resolveUrl(`${unitTypeCollectionName}/${unitKey}`, undefined, true)
    }
    if (!unitUrl) return
    let unitSuffix
    for (const s of (['js', ...(this.sys.autoResolverSuffixes[unitType] ?? [])].sort())) {
        if (unitUrl.pathname.endsWith(`.${s}`)) { unitSuffix = s; break }
        const testPath = `${unitUrl.pathname}.${s}`, testUrl = `${unitUrl.protocol}//${unitUrl.host}${testPath}`
        if ((await fetch(testUrl, { method: 'HEAD' })).ok) {
            unitUrl.pathname = testPath
            unitSuffix = s
            break
        }
    }
    if (!unitSuffix) return
    let unitModule, unit
    if (unitUrl) {
        switch (unitSuffix) {
            case 'js': case 'wasm': unit = this.resolveImport(unitUrl); break
            case 'json':
                unitModule = await (await fetch(unitUrl.href)).json()
            default:
                if (!unitModule) unitModule = (await this.parse(unitModule = (await fetch(unitUrl.href)))) ?? (await unitModule.text())
                const { hash } = unitUrl
                unit = hash ? ((unit && typeof unit === 'object') ? unit[hash] : undefined) : unitModule
        }
    }
    return unit
}