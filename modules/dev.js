const module = {

    exportComponent: {
        enumerable: true, value: async function (id, format = 'plain') {
            if (id instanceof HTMLElement) id = id instanceof this.Component ? id.constructor.id : (this.app.components.instances.get(id)?.constructor?.id)
            const componentClass = id.prototype && id.prototype instanceof this.Component ? id : this.app.components.classes[id]
            const componentManifest = {
                id, extends: componentClass.extends ?? 'HTMLElement',
                style: componentClass.style ?? '',
                template: componentClass.template ?? '',
                descriptors: Object.getOwnPropertyDescriptors(componentClass),
            }
            switch (format) {
                case 'json': case 'xdr':
                    if (componentManifest.style instanceof HTMLStyleElement) componentManifest.style = componentManifest.style.textContent
                    if (componentManifest.template instanceof HTMLTemplateElement) componentManifest.template = componentManifest.template.content.cloneNode(true).textContent
                    for (const key in componentManifest.descriptors) {
                        const descriptor = componentManifest.descriptors[key]
                        for (const p of ['value', 'get', 'set']) if (descriptor[p] instanceof Function) descriptor[p] = descriptor.value.toString()
                        if (('value' in descriptor) && format === 'xdr') try { descriptor.value = JSON.stringify(descriptor.value) } catch (e) { delete componentManifest.descriptors[key] }
                    }
                    if (format === 'json') return JSON.stringify(componentManifest)
                    componentManifest.descriptors = Object.entries(componentManifest.descriptors)
                    await this.loadHelper('xdr')
                    const componentType = await this.useHelper('xdr', 'factory', (new URL('../types/Component.x', import.meta.url)).href, 'Component', { name: 'Component', namespace: 'element' })
                    return this.useHelper('xdr', 'stringify', componentManifest, componentType)
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
            }
            if (!facetClass) return facetManifest
            const facetExports = this.app.facets.exports.get(facetClass) ?? {}
            for (const p in facetManifest) facetManifest[p] = JSON.parse(JSON.stringify(facetExports[p] ?? facetClass[p]))
            switch (format) {
                case 'json': case 'xdr':
                    if (format === 'json') return JSON.stringify(facetManifest, options?.replacer, options?.space)
                    await this.loadHelper('xdr')
                    const facetType = await this.useHelper('xdr', 'factory', (new URL('../types/Facet.x', import.meta.url)).href, 'Facet', { name: 'Facet', namespace: 'element' })
                    return this.useHelper('xdr', 'stringify', facetManifest, facetType)
                default:
                    return facetManifest
            }
        }
    },
    exportPackage: {
        enumerable: true, value: async function (includePackages = new Set(), includeComponents = new Set(), includeFacets = new Set()) {
            const openingLine = 'const Package = {};\n', closingLine = '\nexport default Package;', packageChunks = [], packageUrls = [], appPackages = this.app.packages ?? new Map()
            if (Array.isArray(includePackages)) {
                for (const packageKey of includePackages) if (appPackages.has(packageKey)) packageUrls.push(appPackages.get(packageKey))
            } else if (includePackages instanceof Set) {
                for (const [packageKey, packageUrl] of appPackages.entries()) if (!includePackages.has(packageKey)) packageUrls.push(packageUrl)
            }
            for (const packageUrl of packageUrls) packageChunks.push((await (await fetch(packageUrl)).text()).trim().split('\n')
                .filter(l => !(l.trim().startsWith(openingLine) || l.trim().startsWith(closingLine))).join('\n').trim())
            for (const [lc, uc] of [['components', 'Component'], ['facets', 'Facet']]) {
                const m = new Map(), include = lc === 'components' ? includeComponents : includeFacets
                if (Array.isArray(include)) {
                    let t
                    for (const id of include) if (t = (this.env[lc][id] ?? this.app[lc].classes[id])) m.set(id, t)
                } else if (include instanceof Set) {
                    for (const id in this.env[lc]) if (!include.has(id)) m.set(id, this.env[lc][id])
                    for (const id in this.app[lc].classes) if (!include.has(id)) m.set(id, this.app[lc].classes[id])
                }
                if (m.size) packageChunks.push(`Package.${lc} ??= {}`)
                for (const id of m.keys()) packageChunks.push(`Package.${lc}['${id}'] = ${await this[`export${uc}`](id, 'json')}`)
            }
            packageChunks.unshift(openingLine)
            packageChunks.push(closingLine)
            return packageChunks.join('\n')
        }
    },


    exportApplication: {
        enumerable: true, value: async function* (manifest, handler) {

            const mergeVars = (obj) => { for (const v in vars) for (const k in obj) if (typeof obj[k] === 'string') obj[k] = obj[k].replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v]) },
                slashesRegExp = /^\/|\/$/g, { base, vars = {}, pages = {}, assets = {}, pwa } = manifest
            let { robots, sitemap } = manifest, sitemapObj, sitemapDefaults
            switch (typeof sitemap) {
                case 'boolean':
                    if (sitemap) {
                        sitemapObj = {}
                        sitemapDefaults = { changefreq: 'weekly', priority: 0.5, lastmod: new Date().toISOString() }
                    }
                    break
                case 'object':
                    sitemapObj = {}
                    sitemapDefaults = { changefreq: sitemap.changefreq ?? 'weekly', priority: sitemap.priority ?? 0.5, lastmod: sitemap.lastmod ?? (new Date().toISOString()) }
                    break
            }
            if (!base) return
            for (const pathname in pages) {
                if (pathname.match(slashesRegExp)) continue
                const page = pages[pathname]
                mergeVars(page)
                const { source = globalThis.location.href, name = vars.name, title = vars.title, image = vars.image } = page,
                    filepath = pathname.endsWith('.html') ? pathname : `${pathname}/index.html`,
                    canonicalUrl = new URL(pathname, base).href, canonicalImage = (new URL(image, base)).href,
                    sourceUrl = new URL(source, globalThis.location.href).href, sourceFetch = await fetch(sourceUrl),
                    sourceText = sourceFetch.ok ? (await sourceFetch.text()) : undefined
                if (!sourceText) continue
                const template = document.createElement('template')
                template.innerHTML = sourceText
                for (const metaType of ['link', 'meta', 'og', 'schema', 'twitter']) if (page[metaType] && (typeof page[metaType] === 'object')) mergeVars(page[metaType])
                const metaMaps = {
                    link: { icon: image, canonical: canonicalUrl, manifest: page.link?.manifest ?? (pwa ? '/manifest.json' : undefined), ...(page.link ?? {}) },
                    meta: { 'application-name': name, ...(page.meta ?? {}) },
                    og: { type: 'website', site_name: name, title, image: canonicalImage, url: canonicalUrl, description: page.meta?.description, ...(page.og ?? {}) },
                    schema: {
                        '@context': 'https://schema.org', '@type': 'WebSite', name, headline: title, image: canonicalImage,
                        url: canonicalUrl, description: page.meta?.description, keywords: page.meta?.keywords, author: page.meta?.author, ...(page.schema ?? {})
                    },
                    twitter: { card: 'summary_large_image', image: canonicalImage, url: canonicalUrl, description: page.meta?.description, ...(page.twitter ?? {}) }
                }
                switch (page.robots && !metaMaps.meta['robots']) {
                    case true: metaMaps.meta['robots'] = 'index, follow'; break
                    case false: metaMaps.meta['robots'] = 'noindex, nofollow'; break
                    default: if (typeof page.robots === 'string') metaMaps.meta['robots'] = page.robots
                }
                if (sitemapDefaults && page.sitemap) sitemapObj[canonicalUrl] = { ...(typeof page.sitemap === 'object' ? page.sitemap : {}), ...sitemapDefaults }
                const head = template.content.querySelector('head')
                if (!head) continue
                for (const type in metaMaps) {
                    const placeholder = head.querySelector(`meta[name="element-${type}"]`) ?? (page[type] ? head.insertAdjacentElement('beforeend', document.createElement('meta')) : undefined)
                    if (!placeholder) continue
                    if (type === 'schema') {
                        const schemaElement = document.createElement('script')
                        schemaElement.setAttribute('type', 'application/ld+json')
                        if (placeholder.content) metaMaps.schema = Object.fromEntries(placeholder.content.split(',').map(s => s.trim()).filter(s => s).map(s => metaMaps.schema[s]))
                        schemaElement.textContent = JSON.stringify(metaMaps.schema)
                        placeholder.replaceWith(schemaElement)
                        return
                    }
                    if (placeholder.content) metaMaps[type] = Object.fromEntries(placeholder.content.split(',').map(s => s.trim()).filter(s => s).map(s => metaMaps[type][s]))
                    const metaTemplate = document.createElement('template')
                    for (const n in metaMaps[type]) {
                        let el
                        switch (type) {
                            case 'link':
                                el = document.createElement('link')
                                el.setAttribute('rel', n)
                                el.setAttribute('href', metaMaps[type][n])
                                break
                            case 'meta': case 'og': case 'twitter':
                                el = document.createElement('meta')
                                m.setAttribute(type === 'og' ? 'property' : 'name', type === 'meta' ? n : `${type}:${n}`)
                                m.setAttribute('content', metaMaps[type][n])
                                break
                        }
                        metaTemplate.content.appendChild(el)
                    }
                    placeholder.replaceWith(...metaTemplate.content.cloneNode(true).children)
                }
                let swPlaceholder = pwa ? head.querySelector(`meta[name="element-sw"]`) : undefined
                if (!swPlaceholder && pwa) swPlaceholder = head.insertAdjacentElement('beforeend', document.createElement('meta'))
                if (swPlaceholder) {
                    const swElement = document.createElement('script'),
                        swFilename = (swPlaceholder.content ? (swPlaceholder.content.endsWith('.js') ? swPlaceholder.content : `${swPlaceholder.content}.js`) : 'sw.js').trim()
                    swElement.setAttribute('type', 'application/javascript')
                    swElement.textContent = `navigator.serviceWorker.register('/${swFilename}', { scope: '/' }).catch(function(err) { console.log('ServiceWorker registration failed: ', err); });`
                    swPlaceholder.replaceWith(swElement)
                    assets[swFilename] ??= new File([new Blob(['// empty service worker'], { type: 'application/javascript' })], swFilename, { type: 'application/javascript' })
                }
                for (const blockPlaceholder of head.querySelectorAll('meta[name="element-block"]')) {
                    const block = blockPlaceholder.content.trim()
                    if (!block) continue
                    let blockTemplateInnerHTML = (page.blocks ?? {})[block] ?? (vars.blocks ?? {})[block]
                    for (const v in vars) blockTemplateInnerHTML = blockTemplateInnerHTML.replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v])
                    const blockTemplate = document.createElement('template')
                    blockTemplate.innerHTML = blockTemplateInnerHTML
                    blockPlaceholder.replaceWith(...blockTemplate.content.cloneNode(true).children)
                }
                yield { filepath, file: new File([new Blob([template.innerHTML], { type: 'text/html' })], filepath.split('/').pop(), { type: 'text/html' }) }
            }
            if (pwa) {
                mergeVars(pwa)
                assets['manifest.json'] ??= new File([new Blob([JSON.stringify(pwa, null, 4)], { type: 'application/json' })], 'manifest.json', { type: 'application/json' })
            }
            if (robots === true) robots = ['User-agent: *'].join('\n')
            if (robots) assets['robots.txt'] ??= new File([new Blob([JSON.stringify(robots, null, 4)], { type: 'text/plain' })], 'robots.txt', { type: 'text/plain' })
            if (sitemap) {
                let sitemapContent = []
                if (typeof sitemap === 'string') sitemapContent = [sitemap]
                if (sitemapObj) {
                    const urlsetElement = document.createElement('urlset'), urlElements = []
                    urlsetElement.setAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
                    for (const loc in sitemapObj) urlElements[urlElements.push(document.createElement('url'))].innerHTML = Object.entries(sitemapObj[loc]).map(e => `<${e[0]}>${e[1]}</${e[0]}>`).join('')
                    urlsetElement.replaceChildren(...urlElements)
                    sitemapContent = [`<?xml version="1.0" encoding="UTF-8"?>`, urlsetElement.outerHTML]
                }
                assets['sitemap.xml'] ??= new File([new Blob([JSON.stringify(sitemapContent.join('\n'), null, 4)], { type: 'application/xml' })], 'sitemap.xml', { type: 'application/xml' })
            }
            for (const filepath in assets) {
                if (!assets[filepath]) continue
                if (assets[filepath] instanceof File) {
                    yield { filepath, file: assets[filepath] }
                    continue
                }
                if (assets[filepath] instanceof Blob) {
                    yield { filepath, file: new File([assets[filepath]], filepath.split('/').pop(), { type: assets[filepath].type }) }
                    continue
                }
                if (typeof assets[filepath] === 'string') {
                    const sourceFetch = await fetch(assets[filepath])
                    if (sourceFetch.status !== 200) continue
                    const blob = await sourceFetch.blob()
                    yield { filepath, file: new File([blob], filepath.split('/').pop(), { type: blob.type }) }
                    continue
                }
            }








            // const { source, priority, name, author, title, description, icon, links, meta, og, cards, schema, dc, blocks, pwa, robots, sitemap, assets, targets, vars } = manifest
            // const metaTypesConfig = { og: { nameAttr: 'property', namePrefix: 'og' }, cards: { namePrefix: 'twitter' }, dc: { namePrefix: 'dc' } }
            // const sitemapEntries = sitemap === true ? [] : (Array.isArray(sitemap) ? [...sitemap] : undefined)
            // const application = {}
            // if (targets[0] !== 'index.html') targets.unshift('index.html')
            // if (targets[0] === '/') targets[0] === 'index.html'

            // for (let target of targets) {
            //     if (typeof target === 'string') target = { path: target }
            //     const template = document.createElement('template')
            //     template.innerHTML = await (await fetch(target.source ?? source)).text()
            //     let titleElement = template.content.querySelector('head > title'), markerElement = titleElement
            //     if (!'title' in target) target.title = title
            //     if (target.title) titleElement.textContent = target.title
            //     const targetLinks = target.links ?? JSON.parse(JSON.stringify(links))
            //     if (icon && !targetLinks.icon) targetLinks.icon = icon
            //     if (pwa && !targetLinks.manifest) targetLinks.manifest = 'manifest.json'
            //     if (sitemap && !targetLinks.sitemap) targetLinks.sitemap = 'sitemap.xml'
            //     for (const link in targetLinks) {
            //         const linkAttrs = link && typeof link === 'object' ? link : { rel: link, href: targetLinks[link] }
            //         if (!linkAttrs.rel) continue
            //         const linkElement = template.content.querySelector(`head > link[rel="${linkAttrs.rel}"]`) ?? markerElement.insertAdjacentElement(document.createElement('link'))
            //         for (const n in linkAttrs) linkElement.setAttribute(n, linkAttrs[n])
            //         markerElement = linkElement
            //     }
            //     const targetMeta = target.meta ?? JSON.parse(JSON.stringify(meta))
            //     if (pwa && !targetMeta['application-name']) targetMeta['application-name'] = target.name ?? name ?? target.title
            //     if (!targetMeta.author && author) targetMeta.author = author
            //     if (!targetMeta.description && description) targetMeta.description = description
            //     for (const m in targetMeta) {
            //         const metaAttrs = m && typeof m === 'object' ? m : { name: m, content: targetMeta[m] }
            //         if (!metaAttrs.name) continue
            //         const metaElement = template.content.querySelector(`head > meta[name="${metaAttrs.name}"]`) ?? markerElement.insertAdjacentElement(document.createElement('meta'))
            //         for (const n in metaAttrs) metaElement.setAttribute(n, metaAttrs[n])
            //         markerElement = metaElement
            //     }
            //     for (let [sourceType, typeMeta] of Object.entries({
            //         og: target.og ?? (og ? JSON.parse(JSON.stringify(og)) : undefined),
            //         cards: target.cards ?? (cards ? JSON.parse(JSON.stringify(cards)) : undefined),
            //         dc: target.dc ?? (dc ? JSON.parse(JSON.stringify(dc)) : undefined)
            //     })) {
            //         if (!typeMeta) continue
            //         if (typeMeta === true) typeMeta = {}
            //         typeMeta.title ??= targetMeta.title ?? target.title
            //         typeMeta.description ??= targetMeta.description ?? target.description
            //         typeMeta.image ??= targetLinks.icon
            //         if (sourceType === 'cards') typeMeta.card ??= 'summary'
            //         const nameAttr = metaTypesConfig[sourceType].nameAttr ?? 'name', namePrefix = metaTypesConfig[sourceType].namePrefix
            //         for (const m in typeMeta) {
            //             const metaAttrs = m && typeof m === 'object' ? m : { [`${namePrefix}:${m}`]: m, content: typeMeta[m] }
            //             if (!metaAttrs[nameAttr] || !metaAttrs.content) continue
            //             const nameValue = metaAttrs[nameAttr].startsWith(`${namePrefix}:`) ? metaAttrs[nameAttr] : `${namePrefix}:${metaAttrs[nameAttr]}`
            //             const metaElement = template.content.querySelector(`head > meta[${nameAttr}="${nameValue}"]`) ?? markerElement.insertAdjacentElement(document.createElement('meta'))
            //             for (const n in metaAttrs) if (n !== 'content' && n !== nameAttr) metaElement.setAttribute(n, metaAttrs[n])
            //             metaElement.setAttribute(nameAttr, nameValue)
            //             metaElement.setAttribute('content', metaAttrs.content)
            //             markerElement = metaElement
            //         }
            //     }
            //     const targetSchema = target.schema ?? (schema ? JSON.parse(JSON.stringify(schema)) : undefined)
            //     if (targetSchema) {
            //         targetSchema['@context'] ??= 'https://schema.org'
            //         targetSchema['@type'] ??= 'WebSite'
            //         targetSchema.headline ??= targetMeta.title
            //         targetSchema.image ??= [targetLinks.icon]
            //         const targetAuthor = targetMeta.author ?? target.author ?? author
            //         if (targetAuthor) targetSchema.author ??= { '@type': 'Person', name: targetAuthor }
            //         const schemaElement = template.content.querySelector(`head > script[type="application/ld+json"]`) ?? markerElement.insertAdjacentElement(document.createElement('script'))
            //         schemaElement.setAttribute('type', 'application/ld+json')
            //         schemaElement.textContent = JSON.stringify(targetSchema, null, 4)
            //         markerElement = schemaElement
            //     }
            //     let targetBlocks = target.blocks ?? blocks ?? []
            //     targetBlocks = targetBlocks.filter(b => !b.global)
            //     if (blocks) targetBlocks = JSON.parse(JSON.stringify([...(blocks.filter(b => b.global)), ...targetBlocks]))
            //     for (let targetBlock of targetBlocks) {
            //         if (typeof targetBlock === 'string') { targetBlock = { code: targetBlock } }
            //         const { code, position, selector } = targetBlock
            //         if (!code) continue
            //         const blockMarker = selector ? template.content.querySelector(selector) : markerElement
            //         if (!blockMarker) continue
            //         blockMarker.insertAdjacentHTML(position ?? (selector ? 'beforeend' : 'afterend'), code)
            //     }
            //     let targetPath = path ? `${path}/${target.path}` : target.path
            //     if (targetPath.endsWith('/')) targetPath = `${targetPath}index.html`
            //     if (targetPath.startsWith('/')) targetPath = targetPath.slice(1)
            //     if (!targetPath.includes('.')) targetPath = `${targetPath}.html`
            //     application[targetPath] = {
            //         content: template.content.querySelector('html').outerHTML,
            //         contentType: 'text/html'
            //     }
            //     target.url ??= `https://${host}/${targetPath}`
            //     if (sitemap === true) sitemapEntries.push({ loc: `https://${host}/${targetPath}`, priority: target.priority ?? priority })
            // }

            // if (pwa) {
            //     if (pwa === true) pwa = {}
            //     pwa.name ??= name ?? title
            //     pwa.short_name ??= title ?? name
            //     pwa.description ??= description
            //     pwa.icons ??= [{ src: `/${icon}`, sizes: '512x512', type: `image/${icon.split('.').pop()}` }]
            //     pwa.start_url ??= path ? `${path}/${targets[0]}` : `/${targets[0]}`
            //     pwa.display ??= 'standalone'
            //     pwa.background_color ??= '#ffffff'
            //     pwa.theme_color ??= '#000000'
            //     pwa.orientation ??= 'portrait-primary'
            //     application['manifest.json'] = {
            //         content: JSON.stringify(pwa, null, 4),
            //         contentType: 'application/json'
            //     }
            // }

            // if (robots) {
            //     let robotsContent = ''
            //     if (typeof robots === 'string') {
            //         robotsContent = robots
            //     } else {
            //         if (robots === true) robots = {}
            //         robots['User-agent'] ??= '*'
            //         robots.Allow ??= ['/']
            //         robots.Disallow ??= []
            //         for (const d in robots) {
            //             switch (d) {
            //                 case 'Allow': case 'Disallow':
            //                     for (const dd of robots[d]) robotsContent += `${d}: ${dd}\n`
            //                     break
            //                 default:
            //                     robotsContent += `${d}: ${robots[d]}\n`
            //             }
            //         }
            //     }
            //     application['robots.txt'] = {
            //         content: robotsContent,
            //         contentType: 'text/plain'
            //     }
            // }

            // if (sitemap) {
            //     let sitemapContent = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            //     for (const entry of sitemapEntries) {
            //         sitemapContent += `<url><loc>${entry.loc}</loc><priority>${entry.priority}</priority></url>\n`
            //     }
            //     sitemapContent += '</urlset>'
            //     application['sitemap.xml'] = {
            //         content: sitemapContent,
            //         contentType: 'application/xml'
            //     }
            // }

            // for (const asset of (assets ?? [])) application[asset.path] = { content: { '/': asset.path }, contentType: asset.contentType }

            // return application
        }
    },

}

export { module }

