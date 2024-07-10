const module = {

    exportComponent: {
        enumerable: true, value: async function (id, format = undefined, options = {}) {
            if ((id instanceof HTMLElement) || (id instanceof this.Component)) {
                id = id instanceof this.Component ? id.constructor.id : (this.app.components.virtuals.get(id)?.constructor?.id)
            } else if (id.prototype instanceof this.Component) {
                id = id.id
            }
            if (!id) throw new Error('Component id is required')
            const classObject = this.app.components.classes[id]
            if (!classObject) throw new Error(`Component id not found: ${id}`)
            if (format == undefined) return classObject
            const getAllPropertyDescriptors = cls => {
                let ds = { static: {}, instance: {} }
                let curr = cls, d
                while (curr) {
                    d = Object.getOwnPropertyDescriptors(curr)
                    for (const p in d) if (d[p].enumerable || (d[p].set || d[p].get || (d[p].value !== undefined))) ds.static[p] ??= d[p]
                    d = Object.getOwnPropertyDescriptors(curr.prototype)
                    for (const p in d) if (d[p].enumerable || (d[p].set || d[p].get || (d[p].value !== undefined))) ds.instance[p] ??= d[p]
                    curr = curr.extends ? this.app.components.classes[curr.extends] : undefined
                }
                for (const p of ['E', 'id', 'length', 'name', 'prototype', 'observedAttributes']) {
                    if (!ds.static[p]) continue
                    switch (p) {
                        case 'length':
                            if (ds.static[p].value === 0) delete ds.static[p]
                            break
                        case 'observedAttributes':
                            if (ds.static[p].get?.toString() === Object.getOwnPropertyDescriptor(this.Component, 'observedAttributes')?.get?.toString()) delete ds.static[p]
                            break
                        case 'name':
                            if (ds.static[p].value === 'ComponentClass') delete ds.static[p]
                            break
                        default:
                            delete ds.static[p]
                    }
                }
                for (const p of ['E', 'attributeChangedCallback']) {
                    if (!ds.instance[p]) continue
                    switch (p) {
                        case 'attributeChangedCallback':
                            if (ds.instance[p].value?.toString() === this.Component.prototype.attributeChangedCallback.toString()) delete ds.instance[p]
                            break
                        default:
                            delete ds.instance[p]
                    }
                }
                return ds
            }, { attributes, config, events, extends: extendsId, native, lite, properties, style, subspaces, template } = classObject,
                descriptors = getAllPropertyDescriptors(classObject),
                componentManifest = { attributes, config, events, extends: extendsId, native, lite, properties, style, subspaces, template },
                classToString = lite ? undefined : classObject.toString()
            for (const a of ['style', 'template']) {
                if (componentManifest[a] instanceof HTMLElement) componentManifest[a] = componentManifest[a].textContent
                if (!componentManifest[a]) delete componentManifest[a]
            }
            if (!(componentManifest.subspaces ?? []).length) delete componentManifest.subspaces
            for (const a of ['extends', 'lite', 'native']) if (!componentManifest[a]) delete componentManifest[a]
            for (const a of ['attributes', 'config', 'events', 'properties']) {
                if (!componentManifest[a]) continue
                for (const aa of Object.keys(componentManifest[a])) if (!componentManifest[a][aa] || (Array.isArray(componentManifest[a][aa]) && !componentManifest[a][aa].length)) delete componentManifest[a][aa]
                if (!Object.keys(componentManifest[a]).length) delete componentManifest[a]
            }
            if (format === 'class' || format === 'string') {
                const className = options.name ?? id.split('/').pop().replace('.html', '').split('').map((s, i) => (i === 0 ? s.toUpperCase() : s)).join('')
                switch (format) {
                    case 'class':
                        // const returnClass = extendsId ? class extends this.app.components.classes[extendsId] { } : class extends this.Component {
                        //     constructor() {
                        //         super()
                        //         console.log('')
                        //     }
                        // }
                        // if (this.app.components.constructorFunctions[id]) {
                        //     returnClass.prototype.constructor = function () {
                        //         super()
                        //         console.log('')
                        //     }
                        //     // returnClass.prototype.constructor = new Function(this.app.components.constructorFunctions[id]).bind(returnClass.prototype)
                        // }
                        // Object.defineProperties(returnClass, descriptors.static)
                        // Object.defineProperties(returnClass.prototype, descriptors.instance)
                        // return returnClass
                        break
                    case 'string':
                        console.log('line 76', descriptors)
                        console.log('line 77', this.app.components.constructorFunctions[id])
                        const propLines = []
                        for (const a in componentManifest) {
                            propLines.push(`static ${a} = ${JSON.stringify(componentManifest[a])}`)
                        }
                        const propBlock = propLines.length ? propLines.join(`
                        `) : ''
                        return `class ${className} extends ${options.E ?? 'E'}.${extendsId ? ('app.components["' + extendsId + '"]') : 'Component'} {
                            ${propBlock}
                        }`
                }
            }
            if (classToString && (classToString !== this.Component.toString())) componentManifest.class = classToString
            switch (format) {
                case 'plain':
                    return componentManifest
                case 'json':
                    return JSON.stringify(componentManifest, options?.replacer, options?.space)
                case 'xdr':
                    await this.loadHelper('xdr')
                    const componentType = await this.useHelper('xdr', 'factory', (new URL('../types/Component.x', import.meta.url)).href, 'Component', { name: 'Component', namespace: 'element' })
                    return this.useHelper('xdr', 'stringify', componentManifest, componentType)
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
            const openingLine = 'const Package = {};', closingLine = 'export default Package;', packageChunks = [], packageUrls = [], appPackages = this.app.packages ?? new Map()
            if (Array.isArray(includePackages)) {
                for (const packageKey of includePackages) if (appPackages.has(packageKey)) packageUrls.push(appPackages.get(packageKey))
            } else if (includePackages instanceof Set) {
                for (const [packageKey, packageUrl] of appPackages.entries()) if (!includePackages.has(packageKey)) packageUrls.push(packageUrl)
            }
            for (const packageUrl of packageUrls) packageChunks.push(...(await (await fetch(packageUrl)).text()).trim().split('\n').map(s => s.trim())
                .filter(s => !s.startsWith('//')).filter(s => s).filter(s => !s.startsWith(openingLine)).filter(s => !s.startsWith(closingLine)))
            for (const [lc, uc] of [['components', 'Component'], ['facets', 'Facet']]) {
                const m = new Map(), include = lc === 'components' ? includeComponents : includeFacets
                if (Array.isArray(include)) {
                    let t
                    for (const id of include) if ((!(this.app[lc].packages ?? {})[id]) && (t = (this.env[lc][id] ?? this.app[lc].classes[id]))) m.set(id, t)
                } else if (include instanceof Set) {
                    for (const id in this.env[lc]) if ((!include.has(id)) && (!(this.app[lc].packages ?? {})[id])) m.set(id, this.env[lc][id])
                    for (const id in this.app[lc].classes) if ((!include.has(id)) && (!(this.app[lc].packages ?? {})[id])) m.set(id, this.app[lc].classes[id])
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
        enumerable: true, value: async function* (manifest = {}, options = {}) {
            if (typeof manifest === 'string') manifest = await fetch(this.resolveUrl(manifest)).then(r => r.json())
            manifest.base ??= document.location.href.split('/').slice(0, -1).join('/')
            const mergeVars = (obj) => { for (const v in vars) for (const k in obj) if (typeof obj[k] === 'string') obj[k] = obj[k].replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v]) },
                slashesRegExp = /^\/|\/$/g, { base, blocks = {}, vars = {}, pages = { '': {} }, assets = {}, frameworkSrc = 'https://cdn.jsdelivr.net/gh/elementhtml/element/element.js?load&packages' } = manifest,
                fileToDataURL = file => new Promise(r => {
                    const reader = new FileReader()
                    reader.onload = () => r(reader.result)
                    reader.readAsDataURL(file)
                }), optionsAs = options.as ?? {}
            for (const rx in optionsAs) if (optionsAs[rx]) optionsAs[rx] = new RegExp(optionsAs[rx])
            Object.assign(vars, { name: vars.name ?? manifest.name, title: vars.title ?? manifest.title, description: vars.description ?? manifest.description, image: vars.image ?? manifest.image })
            let { pwa, robots, sitemap } = manifest, sitemapObj, sitemapDefaults
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
                const { source = globalThis.location.href, name = vars.name, title = vars.title, description = vars.description, image = vars.image } = page,
                    filepath = pathname ? (pathname.endsWith('.html') ? pathname : `${pathname}/index.html`) : 'index.html',
                    canonicalUrl = new URL(pathname, base).href, canonicalImage = (new URL(image, base)).href,
                    sourceUrl = new URL(source, globalThis.location.href).href, sourceFetch = await fetch(sourceUrl),
                    sourceText = sourceFetch.ok ? (await sourceFetch.text()) : undefined
                if (!sourceText) continue
                const template = document.createElement('html')
                template.innerHTML = sourceText
                const head = template.querySelector('head')
                if (!head) continue
                const elementFrameworkPreloadElement = head.querySelector('link[rel="modulepreload"][href*="element.js?"]'),
                    elementFrameworkModuleElement = head.querySelector('script[type="module"][src*="element.js?"]')
                if (!elementFrameworkModuleElement) continue
                if (elementFrameworkPreloadElement) {
                    const newFrameworkPreloadElement = document.createElement('link')
                    newFrameworkPreloadElement.setAttribute('rel', 'modulepreload')
                    newFrameworkPreloadElement.setAttribute('href', frameworkSrc)
                    elementFrameworkPreloadElement.replaceWith(newFrameworkPreloadElement)
                }
                const newFrameworkModuleElement = document.createElement('script')
                newFrameworkModuleElement.setAttribute('type', 'module')
                newFrameworkModuleElement.setAttribute('src', frameworkSrc)
                elementFrameworkModuleElement.replaceWith(newFrameworkModuleElement)
                const importMapElement = head.querySelector('script[type="importmap"]')
                if (importMapElement) importMapElement.remove()
                if (this.app.compile) for (const facetContainer of template.querySelectorAll(`script[type="directives/element"]`)) {
                    const src = facetContainer.getAttribute('src'), textContent = facetContainer.textContent
                    const directives = await this.canonicalizeDirectives(src ? await fetch(this.resolveUrl(src)).then(r => r.text()) : textContent)
                    if (!directives) break
                    const facetCid = await this.cid(directives), newFacetContainer = document.createElement('script')
                    newFacetContainer.setAttribute('src', facetCid)
                    newFacetContainer.setAttribute('type', 'application/element')
                    facetContainer.replaceWith(newFacetContainer)
                }
                page.meta ??= {}
                if (description) page.meta.description ??= description
                page.link ??= {}
                if (image) page.link.icon = image
                for (const metaType of ['link', 'meta', 'og', 'schema', 'twitter']) if (page[metaType] && (typeof page[metaType] === 'object')) mergeVars(page[metaType])
                const metaMaps = {
                    link: { icon: image, canonical: canonicalUrl, manifest: page.link?.manifest ?? (pwa ? 'manifest.json' : undefined), ...(page.link ?? {}) },
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
                if (sitemapDefaults) sitemapObj[canonicalUrl] = { ...(typeof page.sitemap === 'object' ? page.sitemap : {}), ...sitemapDefaults }
                if (title) {
                    const titleElement = head.querySelector('title') ?? head.insertAdjacentElement('afterbegin', document.createElement('title'))
                    let titleText = title
                    for (const v in vars) titleText = titleText.replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v])
                    titleElement.textContent = titleText
                }
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
                        if (metaMaps[type][n] == null) continue
                        let el
                        switch (type) {
                            case 'link':
                                el = document.createElement('link')
                                el.setAttribute('rel', n)
                                el.setAttribute('href', metaMaps[type][n])
                                break
                            case 'meta': case 'og': case 'twitter':
                                el = document.createElement('meta')
                                el.setAttribute(type === 'og' ? 'property' : 'name', type === 'meta' ? n : `${type}:${n}`)
                                el.setAttribute('content', metaMaps[type][n])
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
                    let blockTemplateInnerHTML = (page.blocks ?? {})[block] ?? (blocks ?? {})[block]
                    for (const v in vars) blockTemplateInnerHTML = blockTemplateInnerHTML.replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v])
                    const blockTemplate = document.createElement('template')
                    blockTemplate.innerHTML = blockTemplateInnerHTML
                    blockPlaceholder.replaceWith(...blockTemplate.content.cloneNode(true).children)
                }
                let file = new File([new Blob([template.outerHTML], { type: 'text/html' })], filepath.split('/').pop(), { type: 'text/html' })
                for (const asFunc in optionsAs) if (optionsAs[asFunc].test(filepath)) file = (asFunc === 'dataUrl') ? await fileToDataURL(file) : (file[asFunc] ? await file[asFunc]() : undefined)
                yield { filepath, file }
            }
            assets['packages/main.js'] ??= new File([new Blob([await this.exportPackage()], { type: 'application/javascript' })], 'main.js', { type: 'application/javascript' })
            if (pwa) {
                const pwaDefaults = {
                    name: vars.title ?? vars.name,
                    short_name: vars.name,
                    description: vars.description,
                    icons: [],
                    start_url: '/index.html',
                    display: 'standalone',
                    background_color: '#ffffff',
                    theme_color: '#ffffff',
                    orientation: 'portrait'
                }
                if (pwa === true) pwa = { ...pwaDefaults }
                for (const n in pwaDefaults) pwa[n] ??= pwaDefaults[n]
                if (pwa.icons.length === 0) {
                    if (vars.image) {
                        pwaDefaults.icons.push({ src: vars.image, sizes: '48x48', type: `image/${vars.image.split('.').pop()}` })
                    } else if (assets['favicon.ico']) {
                        pwaDefaults.icons.push({ src: 'favicon.ico', sizes: '48x48', type: 'image/x-icon' })
                    }
                }
                mergeVars(pwa)
                assets['manifest.json'] ??= new File([new Blob([JSON.stringify(pwa, null, 4)], { type: 'application/json' })], 'manifest.json', { type: 'application/json' })
            }
            if (robots === true) robots = ['User-agent: *', 'Disallow:'].join('\n')
            if (robots) assets['robots.txt'] ??= new File([new Blob([robots], { type: 'text/plain' })], 'robots.txt', { type: 'text/plain' })
            if (sitemap) {
                let sitemapContent = []
                if (typeof sitemap === 'string') sitemapContent = [sitemap]
                if (sitemapObj) {
                    const urlsetElement = document.createElement('urlset'), urlElements = []
                    urlsetElement.setAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
                    for (const loc in sitemapObj) urlElements[urlElements.push(document.createElement('url')) - 1].innerHTML = (`<loc>${loc}</loc>` + Object.entries(sitemapObj[loc]).map(e => `<${e[0]}>${e[1]}</${e[0]}>`).join(''))
                    urlsetElement.replaceChildren(...urlElements)
                    sitemapContent = [`<?xml version="1.0" encoding="UTF-8"?>`, urlsetElement.outerHTML]
                }
                assets['sitemap.xml'] ??= new File([new Blob([sitemapContent.join('\n')], { type: 'application/xml' })], 'sitemap.xml', { type: 'application/xml' })
            }
            for (const filepath in assets) {
                if (!assets[filepath]) continue
                let file = assets[filepath]
                if (file === true) file = filepath
                if (file instanceof Blob) {
                    file = new File([file], filepath.split('/').pop(), { type: file.type })
                } else if (typeof file === 'string') {
                    const sourceFetch = await fetch(file)
                    if (sourceFetch.status !== 200) continue
                    file = await sourceFetch.blob()
                    file = new File([file], filepath.split('/').pop(), { type: file.type })
                }
                if (!(file instanceof File)) continue
                for (const asFunc in optionsAs) if (optionsAs[asFunc].test(filepath)) file = (asFunc === 'dataUrl') ? await fileToDataURL(file) : (file[asFunc] ? await file[asFunc]() : undefined)
                yield { filepath, file }
            }
        }
    },

    saveApplication: {
        enumerable: true, value: async function (manifest, options = {}) {
            const application = {}
            for await (const fileEntry of this.exportApplication(manifest, options)) {
                let { filepath, file } = fileEntry
                application[filepath] ??= file
            }
            return application
        }
    }

}

export { module }

