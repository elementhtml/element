export default async function (value) {
    const { location } = document
    switch (typeof value) {
        case 'string': location = value; break
        case 'object':
            if (!value) break
            for (const k in value) {
                const v = value[k]
                if (k.endsWith('()')) {
                    const funcName = k.trim().slice(0, -2).trim()
                    switch (funcName) {
                        case 'assign': case 'replace': location[funcName]((funcName === 'assign' || funcName === 'replace') ? v : undefined); break
                        case 'back': case 'forward': history[funcName](); break
                        case 'go': history[funcName](parseInt(v) || 0); break
                        case 'pushState': case 'replaceState': history[funcName](...(Array.isArray(v) ? v : [v]))
                    }
                    continue
                }
                if (typeof v === 'string') location[k] = v
            }
    }
}