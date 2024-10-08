const voidElementTags = Object.freeze({
    area: 'href', base: 'href', br: null, col: 'span', embed: 'src', hr: 'size', img: 'src', input: 'value', link: 'href', meta: 'content',
    param: 'value', source: 'src', track: 'src', wbr: null
})


export default async function (element, data) {
    if (!(element instanceof HTMLElement)) return
    element = this.app._components.natives.get(element) ?? element
    const tag = element.tagName.toLowerCase()
    switch (data) {
        case null: case undefined:
            for (const p of ['checked', 'selected']) if (p in element) return element[p] = false
            if ('value' in element) return element.value = ''
            if (tag in this.sys.voidElementTags) return element.removeAttribute(this.sys.voidElementTags[tag])
            return element.textContent = ''
        case true: case false:
            for (const p of ['checked', 'selected', 'value']) if (p in element) return element[p] = data
            if (tag in this.sys.voidElementTags) return element.toggleAttribute(this.sys.voidElementTags[tag])
            return element.textContent = data
    }
    if (typeof data !== 'object') {
        for (const p of ['checked', 'selected']) if (p in element) return element[p] = !!data
        if ('value' in element) return element.value = data
        if (tag in this.sys.voidElementTags) return element.setAttribute(this.sys.voidElementTags[tag], data)
        return element[((typeof data === 'string') && this.sys.regexp.isHTML.text(data)) ? 'innerHTML' : 'textContent'] = data
    }
    const { mappers } = this.sys
    const promises = []
    for (const p in data) {
        if (p in mappers) { mappers[p](element, undefined, true, data[p]); continue }
        if (p.startsWith('::')) {
            const position = p.slice(2)
            if (typeof element[position] !== 'function') continue
            let snippets = data[p]
            if (!snippets) { element[position](snippets); continue }
            if (!Array.isArray(snippets)) if (this.isPlainObject(snippets)) {
                for (const snippetKey in snippets) promises.push(this.resolveUnit(snippetKey, 'snippet').then(s => this.render(s, snippets[snippetKey])).then(s => element[position](...s)))
                continue
            } else snippets = [snippets]
            if (!snippets.length) { element[position](); continue }
            promises.push(this.resolveUnit(snippets, 'snippet').then(s => element[position](...s)))
            continue
        }
        const pFlag = p[0]
        if (pFlag === '&') {
            let child = this.resolveScopedSelector(p, element)
            if (!child) continue
            if (!Array.isArray(child)) { this.render(child, data[p]); continue }
            const useArray = Array.isArray(data[p]) ? [...data[p]] : undefined
            for (const c of child) promises.push(this.render(c, useArray ? useArray.shift() : data[p]))
        }
        else if (pFlag in mappers) mappers[pFlag](element, p.slice(1).trim(), true, data[p])
        else if ((pFlag === '[') && p.endsWith(']')) mappers.$form(element, p.slice(1, -1).trim(), true, data[p])
        else if ((pFlag === '{') && p.endsWith('}')) mappers.$microdata(element, p.slice(1, -1).trim(), true, data[p])
        else if (typeof element[p] === 'function') element[p](data[p])
        else if (p.endsWith(')') && p.includes('(') && (typeof element[p.slice(0, p.indexOf('(')).trim()] === 'function')) {
            let [functionName, argsList] = p.slice(0, -1).split('(')
            functionName = functionName.trim()
            argsList ||= '$'
            if (typeof element[functionName] !== 'function') continue
            argsList = argsList.trim().split(this.sys.regexp.commaSplitter)
            const args = [], labels = { ...element.dataset }
            promises.push(this.createEnvelope({ labels, value: data }).then(envelope => {
                for (let a of argsList) args.push(this.resolveVariable(a, envelope))
                element[functionName](...args)
            }))
        }
        else element[p] = data[p]
    }
    return await Promise.all(promises)
}