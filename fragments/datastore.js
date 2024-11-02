const generateRecordIdentifier = async function (record) {
    try {
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', (new TextEncoder()).encode(JSON.stringify(record))))).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: { error: e, record } })); return }
}, getRecordByIdentifier = function (recordIdentifier) {
    return new Promise((resolve) => {
        const tx = this.db.transaction('records', 'readonly'), store = tx.objectStore('records'), request = store.get(recordIdentifier)
        request.onsuccess = (event) => resolve(event.target.result)
        request.onerror = (event) => resolve()
    })
}, processRecord = async function (record) {
    const recordIdentifier = await generateRecordIdentifier(record)
    if (!recordIdentifier) return
    const tx = this.db.transaction('records', 'readwrite'), store = tx.objectStore('records'), existingRecord = await getRecordByIdentifier.call(this, recordIdentifier)
    if (existingRecord) return
    store.add(record, recordIdentifier)
    updateBuiltInStructures.call(this, record, recordIdentifier)
}, updateBuiltInStructures = async function (record, recordIdentifier) {
    if (!record) return
    const recordTables = new Set(), recordQueries = new Set()
    for (const name in this.tables) {
        const table = this.tables[name], tableType = await this.resolveUnit(table.type, 'type')
        if (tableType.run(record)) {
            recordTables.add(name)
            const tx = this.db.transaction('tables', 'readwrite'), store = tx.objectStore('tables'), tableStoreRequest = store.get(name)
            tableStoreRequest.onsuccess = (event) => {
                const tableSet = new Set(event.target.result ?? [])
                tableSet.add(recordIdentifier)
                store.put([...tableSet], name)
            }
        }
    }
    for (const name in this.queries) {
        const query = this.queries[name], queryType = await this.resolveUnit(query.type, 'type')
        if (!recordTables.has(query.table)) continue
        if (queryType.run(record)) {
            recordQueries.add(name)
            const tx = this.db.transaction('queries', 'readwrite'), store = tx.objectStore('queries'), queryStoreRequest = store.get(name)
            queryStoreRequest.onsuccess = (event) => {
                const querySet = new Set(event.target.result ?? [])
                querySet.add(recordIdentifier)
                store.put([...querySet], name)
            }
        }
    }
    for (const name in this.views) {
        const view = this.views[name]
        if (!(recordTables.intersection(view.tables).size || recordQueries.intersection(view.queries).size)) return
        const viewTransform = await this.resolveUnit(view.transform, 'transform')
        if (!viewTransform) return
        const recordView = await viewTransform.run(record)
        if (recordView === undefined) return
        const tx = this.db.transaction('views', 'readwrite'), store = tx.objectStore('views'), viewStoreRequest = store.get(name)
        viewStoreRequest.onsuccess = (event) => {
            const viewRecords = event.target.result ?? {}
            viewRecords[recordIdentifier] = recordView
            store.put(viewRecords, name)
        }
    }
    for (const name in this.summaries) {
        const summary = this.summaries[name]
        if (!(recordTables.intersection(summary.tables).size || recordQueries.intersection(summary.queries).size)) return
        const summaryTransform = await this.resolveUnit(summary.transform, 'transform')
        if (!summaryTransform) return
        const summaryInput = { tables: {}, summaries: {}, views: {} }
        for (const scopeName in summaryInput) {
            for (const n of summary[scopeName]) {
                summaryInput[scopeName][n] = {}
                const tx = this.db.transaction(scopeName, 'readonly'), store = tx.objectStore(scopeName), request = store.get(n)
                request.onsuccess = (event) => summaryInput[scopeName][n] = event.target.result
            }
        }
        const summaryResult = await summaryTransform.run(summaryInput)
        if (summaryResult === undefined) return
        const tx = this.db.transaction('summaries', 'readwrite'), store = tx.objectStore('summaries')
        store.put(summaryResult, name)
    }
}

export default {
    initializeDB: async function (tables) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, 1)
            request.onupgradeneeded = (event) => {
                this.db = event.target.result
                if (!this.db.objectStoreNames.contains('records')) this.db.createObjectStore('records')
                if (!this.db.objectStoreNames.contains('tables')) this.db.createObjectStore('tables')
                if (!this.db.objectStoreNames.contains('queries')) this.db.createObjectStore('queries')
                if (!this.db.objectStoreNames.contains('views')) this.db.createObjectStore('views')
                if (!this.db.objectStoreNames.contains('summaries')) this.db.createObjectStore('summaries')
                for (const tableName in tables) {
                    const tableStore = this.db.createObjectStore(tableName), indexes = tables[tableName].indexes
                    for (const indexField in indexes) tableStore.createIndex(indexField, indexField, typeof indexes[indexField] == 'object' ? indexes[indexField] : undefined)
                }
            }
            request.onsuccess = (event) => resolve(this.db = event.target.result)
            request.onerror = (event) => reject(this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: { error: event.target.error } })))
        })
    },
    add: async function (record, table, tables, queue) {
        const { E } = this.constructor
        if (table) {
            const tableTypeName = tables[table]?.type
            if (!tableTypeName) return
            return E.resolveUnit(tableTypeName, 'type').then(type => type.run(record)).then(valid => {
                if (!valid) return
                queue.push(record)
                new E.Job(async function () { await this.processQueue() }, `Datastore.prototype.processQueue:${this.name}`)
            })
        }
        queue.push(record)
        new E.Job(async function () { await this.processQueue() }, `Datastore.prototype.processQueue:${this.name}`)
    },
    processQueue: async function (queue) {
        const promises = []
        while (queue.length) {
            const record = queue.shift()
            promises.push(processRecord.call(record))
        }
        await Promise.all(promises)
        if (queue.length) await this.processQueue()
        return
    }
}