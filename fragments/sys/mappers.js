const mappers = {
    '#': (el, mode, v, p, options = {}) => w ? (v == null ? el.removeAttribute('id') : (el.id = v)) : el.id,
    $attributes: function (el, mode, v, p, options = {}) {
        if (!(el && (el instanceof HTMLElement))) return
        const { style, isComputed, get = 'getAttribute', set = 'setAttribute', remove = 'removeAttribute', defaultAttribute = 'name', toggle = 'toggleAttribute', filter } = options,
            target = style ? (isComputed ? window.getComputedStyle(el) : el.style) : el, writable = style ? (w && !isComputed) : w
        p &&= this.toKebabCase(p)
        if (writable) {
            if (p) return target[v == null ? remove : ((!style && (typeof v === 'boolean')) ? toggle : set)](p, v)
            const vIsObject = typeof v === 'object'
            if (vIsObject) for (const k in v) target[v[k] == null ? remove : ((!style && (typeof v[k] === 'boolean')) ? toggle : set)](this.toKebabCase(k), v[k])
            if (vIsObject || style) return
            p ||= defaultAttribute
            return target[(typeof v === 'boolean') ? toggle : set](p, v)
        }
        if (p) return target[get](p)
        const r = {}, iterator = style ? target : el.attributes
        if (iterator.length) for (let i = 0, k, l = iterator.length; i < l; i++) {
            k = iterator[i]
            if (filter && !k.startsWith(filter)) continue
            r[k] = target[get](k)
            if (!style && (r[k] === '')) r[k] = true
        }
        return r
    },
    '@': '$attributes',
    $data: function (el, mode, v, p, options = {}) {
        const { filter = 'data-', defaultAttribute = 'data-value' } = options
        if (!p && !(v && (typeof v === 'object'))) return v ? (el.value = v) : (el.value = '')
        if (p && !p.startsWith(filter)) p = `${filter}${p}`
        if (v && typeof v === 'object') for (const k in v) if (k && !k.startsWith(filter)) {
            v[`${filter}${k}`] = v[k]
            delete v[k]
        }
        return this.sys.mappers.$attributes(el, p, w, v, { defaultAttribute, filter })
    },
    '$': '$data',
    $aria: function (el, mode, v, p, options = {}) { return this.sys.mappers.$data(el, p, w, v, { defaultAttribute: 'aria-label', filter: 'aria-' }) },
    '*': '$aria',
    $style: function (el, mode, v, p, options = {}) { return this.sys.mappers.$attributes(el, p, w, v, { style: true, isComputed: false, get: 'getProperty', set: 'setProperty', remove: 'removeProperty' }) },
    '%': '$style',
    $computed: function (el, mode, v, p, options = {}) { return this.sys.mappers.$attributes(el, p, w, v, { style: true, isComputed: true, get: 'getProperty', set: 'setProperty', remove: 'removeProperty' }) },
    '&': '$computed',
    $inner: function (el, mode, v, p, options = {}) { return w ? (el[this.sys.regexp.isHTML.test(v) ? 'innerHTML' : 'textContent'] = v) : (this.sys.regexp.isHTML.test(el.textContent) ? el.innerHTML : el.textContent) },
    '.': '$inner',
    $content: (el, mode, v, p, options = {}) => w ? (el.textContent = v) : el.textContent,
    '..': '$content',
    $text: (el, mode, v, p, options = {}) => w ? (el.innerText = v) : el.innerText,
    '...': '$text',
    $html: (el, mode, v, p, options = {}) => w ? (el.innerHTML = v) : el.innerHTML,
    '<>': '$html',
    $tag: (el, mode, v, p, options = {}) => w ? (v == null ? el.removeAttribute(p) : (el.setAttribute(p, v.toLowerCase()))) : ((value.getAttribute(p) || value.tagName).toLowerCase()),
    $parent: function (el, mode, v, p, options = {}) {
        el = this.app._components.nativesFromVirtuals.get(el) ?? el
        return (w ?? v ?? p) ? undefined : this.flatten(el.parentElement)
    },
    '^': '$parent',
    $event: function (el, mode, v, p, options = {}) { return (w ?? v) ? undefined : (p ? this.flatten(ev?.detail?.[p]) : this.flatten(ev)) },
    '!': '$event',
    $form: (el, mode, v, p, options = {}) => {
        if (!(el instanceof HTMLElement)) return
        const { tagName } = el, vIsNull = v == null, vIsObject = !vIsNull && (typeof v === 'object')
        switch (tagName.toLowerCase()) {
            case 'form': case 'fieldset':
                if (p) return this.sys.mappers.$form(el.querySelector(`[name="${p}"]`), w, v)
                if (!vIsObject) return
                const r = {}
                for (const fieldName in v) r[fieldName] = this.sys.mappers.$form(el.querySelector(`[name="${fieldName}"]`), w, v[fieldName])
                return r
            default:
                const { type, name } = el
                switch (type) {
                    case undefined: return
                    case 'checkbox': case 'radio':
                        const inputs = el.closest('form,fieldset').querySelectorAll(`[name="${name}"][type=${type}]`)
                        if (!inputs) return
                        const isCheckbox = type === 'checkbox', isRadio = !isCheckbox
                        if (w) {
                            const vIsArray = Array.isArray(v), useV = vIsObject ? v : (vIsArray ? {} : { [v]: true })
                            if (vIsArray) for (const f of v) useV[f] = true
                            for (const c of inputs) if ((c.checked = !!useV[c.value]) && isRadio) return
                            return
                        }
                        const r = isCheckbox ? [] : undefined
                        if (isRadio) for (const f of inputs) if (f.checked) return f.value
                        if (isRadio) return
                        for (const f of inputs) if (f.checked) r.push(f.value)
                        return r
                    default:
                        return w ? (el.value = v) : el.value
                }
        }
    },
    '[]': '$form',
    $microdata: function (el, mode, v, p, options = {}) {
        if (!((el instanceof HTMLElement) && el.hasAttribute('itemscope'))) return
        if (p) {
            const propElement = el.querySelector(`[itemprop="${p}"]`)
            if (!propElement) return
            return w ? this.render(propElement, v) : this.flatten(propElement)
        }
        if (w) if (this.isPlainObject(v)) for (const k in v) this.sys.mappers.$microdata(el, w, v[k], k)
        if (w) return
        const r = {}, p = []
        for (const propElement of el.querySelectorAll('[itemprop]')) p.push(this.flatten(propElement).then(v => (r[propElement.getAttribute('itemprop')] = v)))
        return Promise.all(p).then(() => r)
    },
    '{}': '$microdata',
    $options: function (el, mode, v, p, options = {}) {
        if (!((el instanceof HTMLSelectElement) || (el instanceof HTMLDataListElement))) return
        if (w) {
            const optionElements = []
            if (v && (typeof v === 'object')) {
                const vIsArray = Array.isArray(v), optionsMap = vIsArray ? {} : v
                if (vIsArray) for (const f of v) optionsMap[f] = f
                for (const k in optionsMap) {
                    const optionElement = document.createElement('option')
                    if (!vIsArray) optionElement.setAttribute('value', k)
                    optionElement.textContent = optionsMap[k]
                    optionElements.push(optionElement)
                }
            }
            return el.replaceChildren(...optionElements)
        }
        const rObj = {}, rArr = []
        let isMap
        for (const optionElement of el.children) {
            isMap ||= optionElement.hasAttribute('value')
            const optionText = optionElement.textContent.trim(), optionValue = optionElement.getAttribute('value') || optionText
            rObj[optionValue] = optionText
            if (!isMap) rArr.push(optionText)
        }
        return isMap ? rObj : rArr
    },
    $table: function (el, mode, v, p, options = {}) {
        if (!(el instanceof HTMLTableElement || el instanceof HTMLTableSectionElement)) return
        if (w) {
            if (!Array.isArray(v)) return
            if (el instanceof HTMLTableElement) {
                if (v.length === 0) return
                const headers = Object.keys(v[0])
                if (headers.length === 0) return
                let thead = el.querySelector('thead')
                if (!thead) {
                    thead = document.createElement('thead')
                    el.prepend(thead)
                }
                const headerRow = document.createElement('tr'), ths = []
                for (const header of headers) {
                    const th = document.createElement('th')
                    th.textContent = header
                    ths.push(th)
                }
                headerRow.replaceChildren(...ths)
                thead.replaceChildren(headerRow)
                let tbody = el.querySelector('tbody')
                if (!tbody) {
                    tbody = document.createElement('tbody')
                    el.appendChild(tbody)
                }
                const rows = []
                for (const item of v) {
                    const tr = document.createElement('tr'), tds = []
                    for (const header of headers) {
                        const td = document.createElement('td')
                        td.textContent = item[header] !== undefined ? item[header] : ''
                        tds.push(td)
                    }
                    tr.replaceChildren(...tds)
                    rows.push(tr)
                }
                tbody.replaceChildren(...rows)
            } else if (el instanceof HTMLTableSectionElement && el.tagName.toLowerCase() === 'tbody') {
                const rows = []
                for (const rowData of v) {
                    const tr = document.createElement('tr'), tds = []
                    for (const cellData of rowData) {
                        const td = document.createElement('td')
                        td.textContent = cellData
                        tds.push(td)
                    }
                    tr.replaceChildren(...tds)
                    rows.push(tr)
                }
                el.replaceChildren(...rows)
            }
            return
        }
        if (el instanceof HTMLTableElement) {
            const thead = el.querySelector('thead'), tbody = el.querySelector('tbody'), p = []
            if (!thead || !tbody) return []
            const headers = [], rows = []
            for (const th of thead.querySelectorAll('th')) headers.push(th.textContent.trim())
            for (const tr of tbody.querySelectorAll('tr')) {
                const cells = tr.querySelectorAll('td'), rowObj = {}
                let index = -1
                for (const header of headers) p.push(this.flatten(cells[++index]).then(v => rowObj[header] = v))
                rows.push(rowObj)
            }
            return Promise.all(p).then(() => rows)
        } else if (el instanceof HTMLTableSectionElement && el.tagName.toLowerCase() === 'tbody') {
            const rows = [], p = []
            for (const tr of el.querySelectorAll('tr')) {
                const row = []
                for (const td of tr.querySelectorAll('td')) row.push(this.flatten(td))
                rows.push(Promise.all(row))
            }
            return Promise.all(rows)
        }
        return
    },
}

export default {
    processElementMapper: async function (element, mode, prop, value) {
        if (prop in mappers) return (mode === 'has') || (await mappers[prop](element, mode, value))
        const propFlag = prop[0], propMain = prop.slice(1)
        let r
        if (propFlag in mappers) r = await mappers[propFlag](element, mode, value, propMain)
        else if ((propFlag === '[') && propMain.endsWith(']')) r = await mappers.$form(element, mode, value, propMain.slice(0, -1))
        else if ((propFlag === '{') && propMain.endsWith('}')) r = await mappers.$microdata(element, mode, value, propMain.slice(0, -1))
        return (mode === 'has') ? (prop in element) : ((mode === 'set') ? (element[prop] = value) : (await this.flatten(element[prop])))
    }
}
