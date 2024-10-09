export default async function (facetContainer) {
    const facetInstance = this.app._facetInstances.get(facetContainer)
    for (const p in facetInstance.controllers) facetInstance.controllers[p].abort()
    facetInstance.controller.abort()
    facetInstance.observer.disconnect()
}