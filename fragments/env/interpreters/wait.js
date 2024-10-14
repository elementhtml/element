export default async function (facet, position, envelope, value) {
    const { descriptor, variables } = envelope, { expression } = descriptor, isPlus = (expression[0] === '+'), { sys } = this,
        vOrIsPlus = (variables || isPlus), wrapped = vOrIsPlus && true, valueEnvelope = vOrIsPlus && Object.freeze({ ...envelope, value }),
        done = () => facet.eventTarget.dispatchEvent(new CustomEvent(`done-${position}`, { detail: value })), now = Date.now(), { regex } = sys
    let ms = 0
    if (expression === 'frame') await new Promise(resolve => window.requestAnimationFrame(resolve))
    else if (expression.startsWith('idle')) {
        let timeout = expression.split(':')[0]
        timeout = timeout ? (parseInt(timeout) || 1) : 1
        await new Promise(resolve => window.requestIdleCallback ? window.requestIdleCallback(resolve, { timeout }) : setTimeout(resolve, timeout))
    }
    else if (isPlus) ms = parseInt(this.resolveVariable(expression.slice(1), valueEnvelope, { wrapped })) || 1
    else if (regexp.isNumeric.test(expression)) ms = (parseInt(expression) || 1) - now
    else {
        if (variables?.expression) expression = this.resolveVariable(expression, valueEnvelope, { wrapped })
        const expressionSplit = expression.split(':').map(s => s.trim())
        if ((expressionSplit.length === 3) && expressionSplit.every(s => regexp.isNumeric.test(s))) {
            ms = Date.parse(`${(new Date()).toISOString().split('T')[0]}T${expression}Z`)
            if (ms < 0) ms = (ms + (1000 * 3600 * 24))
            ms = ms - now
        } else {
            ms = Date.parse(expression) - now
        }
    }
    if (ms) await new Promise(resolve => setTimeout(resolve, Math.max(ms, 0)))
    done()
}