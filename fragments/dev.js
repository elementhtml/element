export default async function () {
    const { isPlainObject, modules } = this
    return this.installModule('dev').then(dev => {
        for (const [p, v = dev[p]] of Object.getOwnPropertyNames(dev)) if (isPlainObject.call(this, v)) for (const [pp, vv = v[pp]] in v) if (typeof vv === 'function') v[pp] = vv.bind(this)
    }).then(() => modules.dev.console.welcome())
}