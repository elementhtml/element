export default {
    run: async function (input, envelope, step, args = []) {
        const { E } = this.constructor, state = { ...this.pipelineState, ...(envelope.state ?? {}) }
        for (const k of state) if (E.isWrappedVariable(k)) state[k] = E.resolveVariable(state[k], envelope, { wrapped: true })
        const pipelineEnvelope = Object.freeze({ ...envelope, state })
        if (this.steps instanceof Proxy) return this.steps[step ?? '*'].call(E, input, args, pipelineEnvelope, this)
        if (step && this.steps.has(step)) return this.steps.get(step)?.call(E, input, args, pipelineEnvelope, this)
        let useSteps = step.includes(':') ? E.sliceAndStep(step, this.steps.values()) : this.steps.values()
        for (const step of useSteps) if ((input = await step.call(E, input, args, pipelineEnvelope, this)) === undefined) break
        return input
    }
}