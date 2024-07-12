const module = {

    exportUnit: {
        value: function (unitType, identifier, format) {
            if (unitType !== 'component' && unitType !== 'facet') throw new Error(`Invalid unitType ${unitType}`)
            let unitClass
            if (!identifier) throw new Error(`An identifier is required`)
            if (identifier instanceof HTMLElement) {
                if (unitType === 'component') identifier = this.app.components.virtuals.get(identifier) ?? identifier
                unitClass = unitType === 'component' ? identifier.constructor : this.app.facets.instances.get(identifier).constructor
            } else if (identifier.prototype) {
                unitClass = unitType === 'component' ? (identifier.prototype instanceof this.Component ? identifier : undefined)
                    : (identifier.prototype instanceof this.Facet ? identifier : undefined)
            } else if (typeof identifier === 'string') {
                unitClass = this.app[`${unitType}s`].classes[identifier]
            }
            if (!unitClass) throw new Error(`No ${unitType} found with identifier ${identifier}`)
            switch (format) {
                case 'string':
                    const unitClassString = unitClass.toString()
                    if (unitType === 'facet') return unitClassString
                    const componentClassString = this.Component.toString()
                    if (unitClassString === componentClassString) return `class ${identifier} extends E.Component {}`
                    return unitClassString
                default:
                    return unitClass
            }
        }
    },
    exportComponent: {
        enumerable: true, value: function (id, format) {
            return this.exportUnit('component', id, format)
        }
    },
    exportFacet: {
        enumerable: true, value: function (cid, format) {
            return this.exportUnit('facet', cid, format)
        }
    },

    exportPackage: {
        enumerable: true, value: async function (includes = {}, options = {}, overrides = {}) {
            if (!includes || (typeof includes !== 'object')) throw new Error(`Invalid includes object`)
            for (const a in this.env) if (!Array.isArray(includes[a])) includes[a] ??= new Set()
            const openingLine = 'const Package = {};', closingLine = 'export default Package;', appPackages = this.app.packages ?? new Map(),
                packageChunks = [], packageObj = {}

            const includesPackages = includes.packages instanceof Set ? this.app.packages.keys().filter(k => !includes.packages.has(k))
                : (Array.isArray(includes.packages) ? includes.packages : []), packageUrls = []
            for (const packageKey of includesPackages) if (appPackages.has(packageKey)) packageUrls.push(appPackages.get(packageKey))
            for (const packageUrl of packageUrls) packageChunks.push(...(await (await fetch(packageUrl)).text()).trim().split('\n').map(s => s.trim())
                .filter(s => !s.startsWith('//')).filter(s => s).filter(s => !s.startsWith(openingLine)).filter(s => !s.startsWith(closingLine)))

            const includesComponents = includes.components instanceof Set ? Object.keys(this.app.components.classes).filter(k => !includes.components.has(k)) : includes.components
            if (includesComponents.length) {
                packageObj.components = {}
                const idReplacers = options?.components?.replacers?.id
                for (const id of includesComponents) {
                    let renderId = id
                    if (idReplacers) {
                        for (let r of idReplacers) {
                            if (typeof r === 'string') r = { pattern: document.location.origin, replaceWith: r, flags: undefined }
                            renderId = renderId.replace(new RegExp(r.pattern, r.flags), r.replaceWith)
                        }
                    }
                    packageObj.components[renderId] = this.exportComponent(id, 'string')
                }
            }

            const includesContext = includes.context instanceof Set ? Object.keys(this.env.context).filter(k => !includes.context.has(k)) : includes.context
            if (includesContext.length) {
                packageObj.context = {}
                for (const key of includesContext) try { packageObj.context[key] = JSON.stringify(this.env.context[key]) } catch (e) {
                    throw new Error(`Context key ${key} could not be exported`)
                }
            }

            const includesFacets = includes.facets instanceof Set ? Object.keys(this.app.facets.classes).filter(k => !includes.facets.has(k)) : includes.facets
            if (includesFacets.length) {
                packageObj.facets = {}
                for (const cid of includesFacets) packageObj.facets[cid] = this.exportFacet(cid, 'string')
            }

            for (const ft of ['helpers', 'loaders']) {
                const includesFt = includes[ft] instanceof Set ? Object.keys(this.app.devarchives[ft]).filter(k => !includes[ft].has(k)) : includes[ft]
                if (includesFt.length) {
                    packageObj[ft] = {}
                    for (const n of includesFt) packageObj[ft][n] = this.app.devarchives[ft][n].toString()
                }
            }

            const includesNamespaces = includes.namespaces instanceof Set ? Object.keys(this.env.namespaces).filter(k => !includes.namespaces.has(k)) : includes.namespaces
            if (includesNamespaces.length) {
                packageObj.namespaces = {}
                for (const n of includesNamespaces) packageObj.namespaces[n] = this.env.namespaces[n]
            }

            const includesOptions = includes.options instanceof Set ? Object.keys(this.env.options).filter(k => !includes.options.has(k)) : includes.options
            if (includesOptions.length) {
                packageObj.options = {}
                for (const key of includesOptions) try { packageObj.options[key] = JSON.stringify(this.env.options[key]) } catch (e) {
                    throw new Error(`Options key ${key} could not be exported`)
                }
            }

            const includesRegexp = includes.regexp instanceof Set ? Object.keys(this.env.regexp).filter(k => !includes.regexp.has(k)) : includes.regexp
            if (includesRegexp.length) {
                packageObj.regexp = {}
                for (const n of includesRegexp) if (this.env.regexp[n]) packageObj.regexp[n] = `new RegExp("${this.env.regexp[n].source}", "${this.env.regexp[n].flags}")`
            }

            const includesTemplates = includes.templates instanceof Set ? Object.keys(this.env.templates).filter(k => !includes.templates.has(k)) : includes.templates
            if (includesTemplates.length) {
                packageObj.templates = {}
                for (const n of includesTemplates) if (this.env.templates[n]) packageObj.templates[n] = `E => { const t = document.createElement('template'); t.innerHTML = \`${this.env.templates[n].innerHTML}\`; return t }`
            }

            const includesTransforms = includes.transforms instanceof Set ? Object.keys(this.env.transforms).filter(k => !includes.transforms.has(k)) : includes.transforms
            if (includesTransforms.length) {
                packageObj.transforms = {}
                for (const n of includesTransforms) {
                    packageObj.transforms[n] = this.env.transforms[n] ?? ((this.app.transforms[n] ?? [])[0])
                    if (!packageObj.transforms[n]) delete packageObj.transforms[n]
                }
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

