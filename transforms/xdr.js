export default async function (operation, ...args) {
    this.app.libraries.xdr ??= (await import('https://cdn.jsdelivr.net/gh/cloudouble/simple-xdr/xdr.min.js')).default
    return this.app.libraries.xdr[operation](...args)
}