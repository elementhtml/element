const module = {

    exportComponent: {
        enumerable: true, value: async function (id, format = 'plain') {
            if (id instanceof HTMLElement) id = id instanceof this.Component ? id.constructor.id : (this.app.components.instances.get(id)?.constructor?.id)
            const componentManifest = {
                id, extends: this.extends[id] ?? 'HTMLElement',
                style: this.styles[id] ?? '',
                template: this.templates[id] ?? '',
                class: this.classes[id]
            }
            switch (format) {
                case 'json': case 'xdr':
                    if (componentManifest.style instanceof HTMLStyleElement) componentManifest.style = componentManifest.style.textContent
                    if (componentManifest.template instanceof HTMLTemplateElement) componentManifest.template = componentManifest.template.content.cloneNode(true).textContent
                    if (componentManifest.class instanceof Function) componentManifest.class = componentManifest.class.toString()
                    if (format === 'json') return JSON.stringify(componentManifest)
                    await this.loadHelper('xdr')
                    return this.useHelper('xdr', 'stringify', componentManifest, await this.getXdrType('component'))
                default:
                    return componentManifest
            }
        }
    },
    exportFacet: {
        enumerable: true, value: async function (source, format = 'plain', options = {}) {
            const facetManifest = { fieldNames: [], cellNames: [], statements: [], cid: undefined }
            if (!source) return facetManifest
            let facetClass
            switch (typeof source) {
                case 'string':
                    facetClass = this.app.facets.classes[source] ?? this.env.facets[source]
                case 'function':
                    facetClass ??= source
                case 'object':
                    if (source instanceof HTMLElement) facetClass ??= this.app.facets.instances.get(source)?.constructor
                    if (facetClass) for (const p in facetManifest) facetManifest[p] = facetClass[p]
            }
            switch (format) {
                case 'json': case 'xdr':
                    if (format === 'json') return JSON.stringify(facetManifest, options?.replacer, options?.space)
                    await this.loadHelper('xdr')
                    const facetType = await this.useHelper('xdr', 'factory', (new URL('../types/Facet.x', import.meta.url)).href, 'Facet', { name: 'Facet', namespace: 'element' })

                    console.log('line 45', facetManifest, facetType.manifest)

                    return this.useHelper('xdr', 'stringify', facetManifest, facetType)
                default:
                    return facetManifest
            }
        }
    },
    exportPackage: {
        enumerable: true, value: async function (includePackages, includeComponents, includeFacets) {
            includePackages ??= new Set()
            includeComponents ??= new Set()
            includeFacets ??= new Set()
            const openingLine = 'const Package = {}', closingLine = 'export default Package', packageChunks = [], packageUrls = [], appPackages = this.app.packages ?? new Map()
            if (Array.isArray(includePackages)) {
                for (const packageKey of includePackages) if (appPackages.has(packageKey)) packageUrls.push(appPackages.get(packageKey))
            } else if (includePackages instanceof Set) {
                for (const [packageKey, packageUrl] of appPackages.entries()) if (!includePackages.has(packageKey)) packageUrls.push(packageUrl)
            }
            for (const packageUrl of packageUrls) packageChunks.push((await (await fetch(packageUrl)).text()).trim().split('\n')
                .filter(l => !(l.trim().startsWith(openingLine) || l.trim().startsWith(closingLine))).join('\n').trim())
            for (const [lc, uc] of [['component', 'Component'], ['facet', 'Facet']]) {
                const m = new Map(), include = lc === 'component' ? includeComponents : includeFacets
                if (Array.isArray(include)) {
                    for (const id of include) if (this.env[lc][id]) m.set(id, this.env[lc][id])
                } else if (include instanceof Set) {
                    for (const id in this.env[lc]) if (!include.has(id)) m.set(id, this.env[lc][id])
                }
                if (m.size) {
                    packageChunks.push(`package.${lc}s ??= {}`)
                    for (const [id, manifest] of m.entries()) packageChunks.push(`package.${lc}s['${id}'] = ${await this[`export${uc}`](id, 'json')}`)
                }
            }
            packageChunks.push('export default Package')
            return packageChunks.join('/n/n')
        }
    },
    exportApplication: {
        enumerable: true, value: async function (manifest) {
            const { source, priority, name, author, title, description, icon, links, meta, og, cards, schema, dc, blocks, pwa, robots, sitemap, assets, targets, vars } = manifest
            const metaTypesConfig = { og: { nameAttr: 'property', namePrefix: 'og' }, cards: { namePrefix: 'twitter' }, dc: { namePrefix: 'dc' } }
            const sitemapEntries = sitemap === true ? [] : (Array.isArray(sitemap) ? [...sitemap] : undefined)
            const application = {}
            if (targets[0] !== 'index.html') targets.unshift('index.html')
            if (targets[0] === '/') targets[0] === 'index.html'

            for (let target of targets) {
                if (typeof target === 'string') target = { path: target }
                const template = document.createElement('template')
                template.innerHTML = await (await fetch(target.source ?? source)).text()
                let titleElement = template.content.querySelector('head > title'), markerElement = titleElement
                if (!'title' in target) target.title = title
                if (target.title) titleElement.textContent = target.title
                const targetLinks = target.links ?? JSON.parse(JSON.stringify(links))
                if (icon && !targetLinks.icon) targetLinks.icon = icon
                if (pwa && !targetLinks.manifest) targetLinks.manifest = 'manifest.json'
                if (sitemap && !targetLinks.sitemap) targetLinks.sitemap = 'sitemap.xml'
                for (const link in targetLinks) {
                    const linkAttrs = link && typeof link === 'object' ? link : { rel: link, href: targetLinks[link] }
                    if (!linkAttrs.rel) continue
                    const linkElement = template.content.querySelector(`head > link[rel="${linkAttrs.rel}"]`) ?? markerElement.insertAdjacentElement(document.createElement('link'))
                    for (const n in linkAttrs) linkElement.setAttribute(n, linkAttrs[n])
                    markerElement = linkElement
                }
                const targetMeta = target.meta ?? JSON.parse(JSON.stringify(meta))
                if (pwa && !targetMeta['application-name']) targetMeta['application-name'] = target.name ?? name ?? target.title
                if (!targetMeta.author && author) targetMeta.author = author
                if (!targetMeta.description && description) targetMeta.description = description
                for (const m in targetMeta) {
                    const metaAttrs = m && typeof m === 'object' ? m : { name: m, content: targetMeta[m] }
                    if (!metaAttrs.name) continue
                    const metaElement = template.content.querySelector(`head > meta[name="${metaAttrs.name}"]`) ?? markerElement.insertAdjacentElement(document.createElement('meta'))
                    for (const n in metaAttrs) metaElement.setAttribute(n, metaAttrs[n])
                    markerElement = metaElement
                }
                for (let [sourceType, typeMeta] of Object.entries({
                    og: target.og ?? (og ? JSON.parse(JSON.stringify(og)) : undefined),
                    cards: target.cards ?? (cards ? JSON.parse(JSON.stringify(cards)) : undefined),
                    dc: target.dc ?? (dc ? JSON.parse(JSON.stringify(dc)) : undefined)
                })) {
                    if (!typeMeta) continue
                    if (typeMeta === true) typeMeta = {}
                    typeMeta.title ??= targetMeta.title ?? target.title
                    typeMeta.description ??= targetMeta.description ?? target.description
                    typeMeta.image ??= targetLinks.icon
                    if (sourceType === 'cards') typeMeta.card ??= 'summary'
                    const nameAttr = metaTypesConfig[sourceType].nameAttr ?? 'name', namePrefix = metaTypesConfig[sourceType].namePrefix
                    for (const m in typeMeta) {
                        const metaAttrs = m && typeof m === 'object' ? m : { [`${namePrefix}:${m}`]: m, content: typeMeta[m] }
                        if (!metaAttrs[nameAttr] || !metaAttrs.content) continue
                        const nameValue = metaAttrs[nameAttr].startsWith(`${namePrefix}:`) ? metaAttrs[nameAttr] : `${namePrefix}:${metaAttrs[nameAttr]}`
                        const metaElement = template.content.querySelector(`head > meta[${nameAttr}="${nameValue}"]`) ?? markerElement.insertAdjacentElement(document.createElement('meta'))
                        for (const n in metaAttrs) if (n !== 'content' && n !== nameAttr) metaElement.setAttribute(n, metaAttrs[n])
                        metaElement.setAttribute(nameAttr, nameValue)
                        metaElement.setAttribute('content', metaAttrs.content)
                        markerElement = metaElement
                    }
                }
                const targetSchema = target.schema ?? (schema ? JSON.parse(JSON.stringify(schema)) : undefined)
                if (targetSchema) {
                    targetSchema['@context'] ??= 'https://schema.org'
                    targetSchema['@type'] ??= 'WebSite'
                    targetSchema.headline ??= targetMeta.title
                    targetSchema.image ??= [targetLinks.icon]
                    const targetAuthor = targetMeta.author ?? target.author ?? author
                    if (targetAuthor) targetSchema.author ??= { '@type': 'Person', name: targetAuthor }
                    const schemaElement = template.content.querySelector(`head > script[type="application/ld+json"]`) ?? markerElement.insertAdjacentElement(document.createElement('script'))
                    schemaElement.setAttribute('type', 'application/ld+json')
                    schemaElement.textContent = JSON.stringify(targetSchema, null, 4)
                    markerElement = schemaElement
                }
                let targetBlocks = target.blocks ?? blocks ?? []
                targetBlocks = targetBlocks.filter(b => !b.global)
                if (blocks) targetBlocks = JSON.parse(JSON.stringify([...(blocks.filter(b => b.global)), ...targetBlocks]))
                for (let targetBlock of targetBlocks) {
                    if (typeof targetBlock === 'string') { targetBlock = { code: targetBlock } }
                    const { code, position, selector } = targetBlock
                    if (!code) continue
                    const blockMarker = selector ? template.content.querySelector(selector) : markerElement
                    if (!blockMarker) continue
                    blockMarker.insertAdjacentHTML(position ?? (selector ? 'beforeend' : 'afterend'), code)
                }
                let targetPath = path ? `${path}/${target.path}` : target.path
                if (targetPath.endsWith('/')) targetPath = `${targetPath}index.html`
                if (targetPath.startsWith('/')) targetPath = targetPath.slice(1)
                if (!targetPath.includes('.')) targetPath = `${targetPath}.html`
                application[targetPath] = {
                    content: template.content.querySelector('html').outerHTML,
                    contentType: 'text/html'
                }
                target.url ??= `https://${host}/${targetPath}`
                if (sitemap === true) sitemapEntries.push({ loc: `https://${host}/${targetPath}`, priority: target.priority ?? priority })
            }

            if (pwa) {
                if (pwa === true) pwa = {}
                pwa.name ??= name ?? title
                pwa.short_name ??= title ?? name
                pwa.description ??= description
                pwa.icons ??= [{ src: `/${icon}`, sizes: '512x512', type: `image/${icon.split('.').pop()}` }]
                pwa.start_url ??= path ? `${path}/${targets[0]}` : `/${targets[0]}`
                pwa.display ??= 'standalone'
                pwa.background_color ??= '#ffffff'
                pwa.theme_color ??= '#000000'
                pwa.orientation ??= 'portrait-primary'
                application['manifest.json'] = {
                    content: JSON.stringify(pwa, null, 4),
                    contentType: 'application/json'
                }
            }

            if (robots) {
                let robotsContent = ''
                if (typeof robots === 'string') {
                    robotsContent = robots
                } else {
                    if (robots === true) robots = {}
                    robots['User-agent'] ??= '*'
                    robots.Allow ??= ['/']
                    robots.Disallow ??= []
                    for (const d in robots) {
                        switch (d) {
                            case 'Allow': case 'Disallow':
                                for (const dd of robots[d]) robotsContent += `${d}: ${dd}\n`
                                break
                            default:
                                robotsContent += `${d}: ${robots[d]}\n`
                        }
                    }
                }
                application['robots.txt'] = {
                    content: robotsContent,
                    contentType: 'text/plain'
                }
            }

            if (sitemap) {
                let sitemapContent = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                for (const entry of sitemapEntries) {
                    sitemapContent += `<url><loc>${entry.loc}</loc><priority>${entry.priority}</priority></url>\n`
                }
                sitemapContent += '</urlset>'
                application['sitemap.xml'] = {
                    content: sitemapContent,
                    contentType: 'application/xml'
                }
            }

            for (const asset of (assets ?? [])) application[asset.path] = { content: { '/': asset.path }, contentType: asset.contentType }

            return application
        }
    },

    publishApplication: {
        enumerable: true,
        value: async function (application, target) {
            //now publish application bundle to the target hosting platform using the information provided in `target`

        }
    },

    // getXdrType: {
    //     value: async function (manifest, entry, name, namespace = 'element') {
    //         if (typeof manifest === 'string') {
    //             entry ??= manifest
    //             name ??= entry
    //         }
    //         await this.loadHelper('xdr')
    //         let factoryClass
    //         switch (name) {
    //             case 'component': case 'components': case 'Component':
    //                 name = 'Component'
    //                 const stringTypeDec = { type: 'string', parameters: { length: 0, mode: 'variable', optional: false, unsigned: false } }
    //                 manifest = {
    //                     entry, name, namespace,
    //                     structs: { Component: new Map([['id', stringTypeDec], ['extends', stringTypeDec], ['style', stringTypeDec], ['template', stringTypeDec], ['class', stringTypeDec]]) },
    //                     unions: {}, typedefs: {}, enums: {}
    //                 }
    //                 break
    //             case 'facet': case 'facets': case 'Facet':
    //                 name = 'Facet'
    //                 const fixedReqParams = { length: 0, mode: 'fixed', optional: false, unsigned: false }, fixedOptParams = { length: 0, mode: 'fixed', optional: true, unsigned: false },
    //                     variableReqParams = { length: 0, mode: 'variable', optional: false, unsigned: false }, variableOptParams = { length: 0, mode: 'variable', optional: true, unsigned: false },
    //                     nameTypeDec = { type: 'Name', parameters: variableReqParams }, variableReqString = { type: 'string', parameters: variableReqParams },
    //                     variableOptString = { type: 'string', parameters: variableOptParams }, handlerTypes = {
    //                         json: 'CtxJson', network: 'CtxNetwork', pattern: 'CtxPattern', proxy: 'CtxProxy',
    //                         router: 'void', routerhash: 'CtxRouterHash', routersearch: 'void', routerpathname: 'void', selector: 'CtxSelector', state: 'CtxState',
    //                         string: 'CtxExpression', transform: 'CtxExpression', variable: 'CtxExpression', wait: 'CtxExpression'
    //                     }
    //                 manifest = {
    //                     entry, name, namespace, structs: {
    //                         Facet: new Map([
    //                             ['cellNames', nameTypeDec], ['fieldNames', nameTypeDec],
    //                             ['hash', { type: 'string', parameters: { ...fixedReqParams, length: 64 } }], ['statements', { type: 'Statement', parameters: variableReqParams }]
    //                         ]),
    //                         Statement: new Map([['labels', nameTypeDec], ['steps', { type: 'Step', parameters: variableReqParams }]]),
    //                         Step: new Map([['defaultExpression', variableOptString], ['label', { type: 'Name' }], ['labelMode', { type: 'LabelMode', parameters: fixedOptParams }], ['params', { type: 'Params' }]]),
    //                         CtxJson: new Map([['vars', { type: 'VarsJson' }]]),
    //                         VarsJson: new Map([['value', variableReqString]]),
    //                         CtxNetwork: new Map([['vars', { type: 'VarsNetwork' }]]),
    //                         VarsNetwork: new Map([['expression', variableReqString], ['expressionIncludesValueAsVariable', { type: 'bool' }], ['hasDefault', { type: 'bool' }], ['returnFullRequest', { type: 'bool' }]]),
    //                         CtxPattern: new Map([['binder', { type: 'bool' }], ['vars', { type: 'VarsPattern' }]]),
    //                         VarsPattern: new Map([['expression', variableReqString], ['regexp', variableReqString]]),
    //                         CtxProxy: new Map([['binder', { type: 'bool' }], ['vars', { type: 'VarsProxy' }]]),
    //                         VarsProxy: new Map([
    //                             ['childArgs', variableOptString], ['childMethodName', variableOptString],
    //                             ['parentArgs', variableReqString], ['parentObjectName', variableReqString], ['useHelpers', { type: 'bool' }]
    //                         ]),
    //                         CtxRouterHash: new Map([['binder', { type: 'bool' }], ['vars', { type: 'VarsRouterHash' }]]),
    //                         VarsRouterHash: new Map([['signal', { type: 'bool' }]]),
    //                         CtxSelector: new Map([['binder', { type: 'bool' }], ['vars', { type: 'VarsSelector' }]]),
    //                         VarsSelector: new Map([['scopeStatement', variableReqString], ['selectorStatement', variableReqString], ['signal', { type: 'bool' }]]),
    //                         CtxState: new Map([['binder', { type: 'bool' }], ['vars', { type: 'VarsState' }]]),
    //                         VarsState: new Map([['expression', variableReqString], ['signal', { type: 'bool' }], ['typeDefault', { type: 'string', parameters: { ...fixedReqParams, length: 1 } }]]),
    //                         CtxExpression: new Map([['vars', { type: 'VarsExpression' }]]),
    //                         VarsExpression: new Map([['expression', variableReqString]])
    //                     },
    //                     unions: { Params: { discriminant: { type: 'HandlerType', identifier: 'handler' }, arms: {} } },
    //                     typedefs: { Name: variableReqString },
    //                     enums: { LabelMode: [null, 'force', 'silent'], HandlerType: [null, ...Object.keys(handlerTypes)] }
    //                 }
    //                 for (const arm in handlerTypes) manifest.unions.Params.arms[arm] = { type: handlerTypes[arm], identifier: 'ctx', arm }
    //                 break
    //             default:
    //                 factoryClass = await this.app.libraries.xdr.factory(manifest, entry, { name, namespace })
    //         }
    //         return factoryClass ?? class extends this.app.libraries.xdr.types._base.Composite {
    //             static entry = entry
    //             static name = name
    //             static namespace = namespace
    //             static manifest = manifest
    //         }
    //     }
    // }

}

export { module }