const voidElementTags = Object.freeze({
    area: 'href', base: 'href', br: null, col: 'span', embed: 'src', hr: 'size', img: 'src', input: 'value', link: 'href', meta: 'content',
    param: 'value', source: 'src', track: 'src', wbr: null
})

export default async function (element, data) {
    if (!(element instanceof HTMLElement)) return
    element = this.app._components.virtualsFromNatives.get(element) ?? element
    const tag = element.tagName.toLowerCase()
    switch (data) {
        case null: case undefined:
            for (const p of ['checked', 'selected']) if (p in element) return element[p] = false
            if ('value' in element) return element.value = ''
            if (tag in voidElementTags) return element.removeAttribute(voidElementTags[tag])
            return element.textContent = ''
        case true: case false:
            for (const p of ['checked', 'selected', 'value']) if (p in element) return element[p] = data
            if (tag in voidElementTags) return element.toggleAttribute(voidElementTags[tag])
            return element.textContent = data
    }
    if (typeof data !== 'object') {
        for (const p of ['checked', 'selected']) if (p in element) return element[p] = !!data
        if ('value' in element) return element.value = data
        if (tag in voidElementTags) return element.setAttribute(voidElementTags[tag], data)
        return element[((typeof data === 'string') && this.sys.regexp.isHTML.text(data)) ? 'innerHTML' : 'textContent'] = data
    }
    const { processElementMapper } = await this.runFragment('sys/mappers'), promises = []
    for (const p in data) promises.push(processElementMapper.call(this, element, 'set', p, data[p]))
    return await Promise.all(promises)
}