export default function (obj) {
    if (!this.isPlainObject(obj)) return {}
    const formRender = {}
    for (const k in obj) formRender[`\`[name="${k}"]\``] = obj[k]
    return formRender
}