export default async function () {
    const { modules } = this
    return this.installModule('compile').then(({ parsers, globalNamespace }) => {
        for (const [, interpreter] of this.env.interpreters) interpreter.parser = parsers[interpreter.name].bind(this)
        Object.defineProperty(window, globalNamespace, { value: this })
    })
}