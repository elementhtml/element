export default async function (facet, position, envelope, value) {
    const { descriptor } = envelope, { types, mode } = descriptor, info = mode === 'info', promises = [], wrapped = true, valueEnvelope = { ...envelope, value }
    for (const t of types) if (this.isWrappedVariable(t.name)) promises.push(this.resolveUnit(this.resolveVariable(t.name, valueEnvelope, { wrapped }), 'type'))
    await Promise.all(promises)
    let pass = info
    if (info) {
        const validation = {}, promises = []
        for (const { name } of types) promises.push(this.runUnit(name, 'type', value, true).then(r => validation[name] = r))
        await Promise.all(promises)
        return { value, validation }
    }
    const [any, all] = [mode === 'any', mode === 'all']
    for (const { if: ifMode, name } of types) if (pass = (ifMode === (await this.runUnit(name, 'type', value)))) { if (any) break; } else if (all) break
    if (pass) return value
}