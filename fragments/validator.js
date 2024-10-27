export default {
    run: async function (input, envelope, facet, position, options = {}) {
        const instance = this instanceof this.constructor ? this : new this(), validationResults = {}, { verbose } = options
        let valid = true
        for (const key of Object.keys(instance)) if (typeof instance[key] === 'function') {
            validationResults[key] = await instance[key](input, envelope)
            valid = validationResults[key] === true
            if (!valid && !verbose) return false
        }
        return verbose ? validationResults : true
    }
}