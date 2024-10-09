export default {
    run: async function (input, verbose, envelope) {
        const instance = this instanceof this.constructor ? this : new this(), validationResults = {}
        let valid = true
        for (const key of Object.keys(instance)) if (typeof instance[key] === 'function') {
            validationResults[key] = await instance[key](input, envelope)
            valid = validationResults[key] === true
            if (!valid && !verbose) return false
        }
        return verbose ? validationResults : true
    }
}