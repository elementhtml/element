export default function (event, selector, scope, exactMatch, defaultEventTypes, keepDefault, container, position) {
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
    container.dispatchEvent(new CustomEvent(`done-${position}`, { detail: this.flatten(targetElement, undefined, event) }))
}