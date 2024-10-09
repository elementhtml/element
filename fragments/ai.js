export default {
    run: async function (input, promptTemplateKey, envelope) {
        if (!this.engine) return
        if (typeof input === 'string') {
            const promptTemplate = promptTemplateKey ? (this.promptTemplates[promptTemplateKey] ?? '$') : '$'
            input = this.constructor.E.resolveVariable(promptTemplate, { ...envelope, value: input }, { merge: true })
        }
        return this.engine(input)
    }
}