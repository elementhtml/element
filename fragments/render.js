const voidElementTags = Object.freeze({
    area: 'href', base: 'href', br: null, col: 'span', embed: 'src', hr: 'size', img: 'src', input: 'value', link: 'href', meta: 'content',
    param: 'value', source: 'src', track: 'src', wbr: null
})

export default async function (element, data) {
    const isElement = (element instanceof HTMLElement), isFragment = (element instanceof DocumentFragment), tag = isElement ? element.tagName.toLowerCase() : undefined
    if (!(isElement || isFragment)) return
    element = this.app._components.virtualsFromNatives.get(element) ?? element
    switch (data) {
        case null: case undefined:
            if (isElement) {
                for (const p of ['checked', 'selected']) if (p in element) return element[p] = false
                if ('value' in element) return element.value = ''
                if (tag in voidElementTags) return element.removeAttribute(voidElementTags[tag])
            }
            return element.textContent = ''
        case true: case false:
            if (isElement) {
                for (const p of ['checked', 'selected', 'value']) if (p in element) return element[p] = data
                if (tag in voidElementTags) return element.toggleAttribute(voidElementTags[tag])
            }
            return element.textContent = data
    }
    if (typeof data !== 'object') {
        if (isElement) {
            for (const p of ['checked', 'selected']) if (p in element) return element[p] = !!data
            if ('value' in element) return element.value = data
            if (tag in voidElementTags) return element.setAttribute(voidElementTags[tag], data)
        }
        return element[((typeof data === 'string') && this.sys.regexp.isHTML.test(data)) ? 'innerHTML' : 'textContent'] = data
    }
    const { processElementMapper } = await this.runFragment('sys/mappers'), promises = []
    if (isFragment) console.log(data)
    if (Array.isArray(data)) for (const item of data) promises.push(this.render(element, item))
    else for (const p in data) promises.push(processElementMapper.call(this, element, 'set', p, data[p]))
    return await Promise.all(promises)
}