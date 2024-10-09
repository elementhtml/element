export default {
    run: async function (input, stepKey, envelope) {
        const { E } = this.constructor, state = { ...this.pipelineState, ...(envelope.state ?? {}) }
        for (const k of state) if (E.isWrappedVariable(k)) state[k] = E.resolveVariable(state[k], envelope, { wrapped: true })
        const pipelineEnvelope = Object.freeze({ ...envelope, state })
        if (stepKey && this.steps.has(stepKey)) return this.steps.get(stepKey)?.call(E, input, pipelineEnvelope)
        let useSteps = stepKey.includes(':') ? E.sliceAndStep(stepKey, this.steps.values()) : this.steps.values()
        for (const step of useSteps) if ((input = await step.call(E, input, pipelineEnvelope)) === undefined) break
        return input
    }
}