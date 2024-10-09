export default {
    load: async function (library, load, options) {
        if (this.loaded) return true
        this.library ??= await this.constructor.E.resolveUnit(library, 'library')
        if (!this.library) return
        this.options = options ?? {}
        this.loader ??= load.bind(this)
        if (!this.loader) return
        this.loaded = !!(this.engine ??= (await this.loader(this.library, (this.options.load ?? {}))))
        return this.loaded
    },
    run: async function (input) {
        if (!this.loaded) await this.constructor.E.Job.waitComplete(`model:${this.name}`, Infinity)
        return this.inference(input, this.engine, this.options.inference ?? {})
    }
}