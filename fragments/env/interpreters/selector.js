export default {
    binder: async function (facet, position, envelope) {
        const { descriptor } = envelope, { signal } = descriptor, { scope: scopeStatement, selector: selectorStatement } = descriptor,
            scope = await this.resolveScope(scopeStatement, facet.root), { sys } = this, { defaultEventTypes } = sys
        if (!scope) return {}
        const bangIndex = selectorStatement.lastIndexOf('!')
        let selector = selectorStatement.trim(), eventList
        if ((bangIndex > selector.lastIndexOf(']')) && (bangIndex > selector.lastIndexOf(')')) && (bangIndex > selector.lastIndexOf('"')) && (bangIndex > selector.lastIndexOf("'")))
            [selector, eventList] = [selector.slice(0, bangIndex).trim(), selector.slice(bangIndex + 1).trim()]
        if (eventList) eventList = eventList.split(sys.regexp.commaSplitter).filter(Boolean)
        else {
            const [statementIndex, stepIndex] = position.split('-')
            if (!facet.statements?.[+statementIndex]?.steps[+stepIndex + 1]) return { selector, scope }
        }
        for (let eventName of eventList ?? Array.from(new Set(Object.values(defaultEventTypes).concat(['click'])))) {
            const enSlice3 = eventName.slice(-3), keepDefault = enSlice3.includes('+'), exactMatch = enSlice3.includes('='), once = enSlice3.includes('-')
            for (const [v, r] of [[keepDefault, '+'], [exactMatch, '='], [once, '-']]) if (v) eventName = eventName.replace(r, '')
            scope.addEventListener(eventName, event => {
                let targetElement
                if (selector.endsWith('}') && selector.includes('{')) {
                    targetElement = this.resolveSelector(selector, scope)
                    if (!targetElement || (Array.isArray(targetElement) && !targetElement.length)) return
                } else if (selector[0] === '$') {
                    if (selector.length === 1) return
                    targetElement = exactMatch ? event.target : event.target.closest(selector)
                    if (!targetElement.matches(this.buildCatchallSelector(selector))) return
                } else if (selector && exactMatch && !event.target.matches(selector)) return
                targetElement ??= (exactMatch ? event.target : event.target.closest(selector))
                if (!targetElement) return
                if (!eventList && (event.type !== (targetElement.constructor.events?.default ?? defaultEventTypes[targetElement.tagName.toLowerCase()] ?? 'click'))) return
                if (!keepDefault) event.preventDefault()
                facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(targetElement, undefined, event) }))
            }, { signal, once })
        }
        return { selector, scope }
    }
}


