self.addEventListener('install', (event) => {
    console.log('Element Mesh Service Worker installed.');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('Element Mesh Service Worker activated.');
    event.waitUntil(self.clients.claim());
});

const caches = {
    block: new Map(),
    file: new Map()
}, wallet = { balance: 1000, ledger: [] }

const requestSelfVerifyingItem = async function (itemType, itemAddress, offeredTokens = 1) {
    if (caches[itemType].has(itemAddress)) return caches[itemType].get(itemAddress)
    const peerUnknown = new Set(), peer400 = new Set(), peer402 = {}, peer201 = {}
    for (const peer of peers) peerUnknown.add(peer)
    while (peerUnknown.size + Object.keys(peer201).length + Object.keys(peer402).length) {
        for (const peer of peers) {
            if (peer400.has(peer)) continue
            if ((peer in peer402) && (peerUnknown.size || Object.keys(peer201).length)) continue
            if (peer201[peer] && peerUnknown.size) continue
            try {
                const response = await fetch(`${peer}/${itemType}/${itemAddress}`, {
                    method: 'POST',
                    body: JSON.stringify({ offeredTokens }),
                    headers: { 'Content-Type': 'application/json' }
                })
                switch (response.status) {
                    case 200:
                        const item = await response.arrayBuffer(), hash = await crypto.subtle.digest('SHA-256', item),
                            computedAddress = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
                        if (computedAddress === itemAddress) return item
                        else {
                            peerUnknown.delete(peer)
                            delete peer402[peer]
                            delete peer201[peer]
                            peer400.add(peer)
                        }
                        break
                    case 201:
                        peerUnknown.delete(peer)
                        delete peer402[peer]
                        peer201[peer] = (peer201[peer] ?? 0) + 1
                        break
                    case 402:
                        peerUnknown.delete(peer)
                        delete peer201[peer]
                        peer402[peer] = (peer402[peer] ?? offeredTokens) + 1
                        break
                    default:
                        peerUnknown.delete(peer)
                        delete peer402[peer]
                        delete peer201[peer]
                        peer400.add(peer)
                }
            } catch (error) {
                peerUnknown.delete(peer)
                delete peer402[peer]
                delete peer201[peer]
                peer400.add(peer)
            }
        }
    }
}, parseFileManifest = function (manifestBuffer) {
    const dataView = new DataView(manifestBuffer), chunks = []
    let offset = 0, contentType = ""
    while (dataView.getUint8(offset) !== 0) {
        contentType += String.fromCharCode(dataView.getUint8(offset))
        offset += 1
    }
    offset += 1
    while (offset < manifestBuffer.byteLength) {
        const chunkAddressBytes = new Uint8Array(manifestBuffer.slice(offset, offset + 32)),
            start = dataView.getUint32(offset += 32), end = dataView.getUint32(offset += 4)
        offset += 4
        chunks.push({ address: Array.from(chunkAddressBytes).map(b => b.toString(16).padStart(2, '0')).join(''), start, end });
    }
    return { contentType, chunks }
}, assembleFile = async function (chunks) {
    let assembledData = new Uint8Array()
    for (const { address: blockAddress, start, end } of chunks)
        assembledData = concatenateUint8Arrays(assembledData, new Uint8Array((await requestSelfVerifyingItem('block', blockAddress)).slice(start, end)))
    return assembledData.buffer
}, concatenateUint8Arrays = function (array1, array2) {
    const concatenatedArray = new Uint8Array(array1.length + array2.length);
    concatenatedArray.set(array1, 0);
    concatenatedArray.set(array2, array1.length);
    return concatenatedArray;
}


// Responding to fetch events to serve chunks and files
self.addEventListener('fetch', async (event) => {
    const url = new URL(event.request.url);

    if (url.protocol === 'e:') {
        const [blockAddress, range] = url.pathname.split('/').slice(1);
        try {
            const blockData = await requestSelfVerifyingItem('block', blockAddress)
            let [start = 0, end = blockData.byteLength] = range ? range.split('-').map(Number) : []
            const chunk = blockData.slice(start, end), response = new Response(chunk)
            event.respondWith(response)
        } catch (error) {
            event.respondWith(new Response('Block not found', { status: 404 }));
        }
    } else if (url.protocol === 'efile:') {
        const fileAddress = url.pathname.slice(1);
        try {
            const fileManifestData = await requestSelfVerifyingItem('file', fileAddress), fileManifest = parseFileManifest(fileManifestData),
                contentType = fileManifest.contentType, assembledData = await assembleFile(fileManifest.chunks), blob = new Blob([assembledData], { type: contentType }),
                response = new Response(blob, { headers: { 'Content-Type': contentType } })
            event.respondWith(response)
        } catch (error) {
            event.respondWith(new Response('File not found', { status: 404 }));
        }
    }
})



// Wallet management
function createTransaction(amount, toAddress) {
    const transaction = { amount, to: toAddress, from: 'self', status: 'pending' };
    wallet.ledger.push(transaction);
    return transaction;
}

function receiveTransaction(transaction) {
    if (transaction.status === 'pending') {
        if (transaction.amount > wallet.balance) {
            transaction.status = 'declined';
        } else {
            wallet.balance -= transaction.amount;
            transaction.status = 'accepted';
            wallet.ledger.push({ ...transaction, from: transaction.to, to: 'self' });
        }
    }
    return transaction.status;
}

// Syncing between peers
async function syncWithPeers() {
    for (const peer of peers) {
        try {
            const response = await fetch(`${peer}/sync`, {
                method: 'GET'
            });
            const peerLedger = await response.json();
            reconcileLedger(peerLedger);
        } catch (error) {
            console.warn(`Failed to sync with peer: ${peer}`, error);
        }
    }
}

function reconcileLedger(peerLedger) {
    // Basic consensus mechanism for prototype
    peerLedger.forEach(peerTx => {
        const localTx = wallet.ledger.find(tx => tx.id === peerTx.id);
        if (!localTx) {
            wallet.ledger.push(peerTx);
            if (peerTx.to === 'self') {
                wallet.balance += peerTx.amount;
            } else if (peerTx.from === 'self') {
                wallet.balance -= peerTx.amount;
            }
        }
    });
}

// Placeholder peers for prototyping
const peers = new Set(['https://example-peer1.com', 'https://example-peer2.com']);

// Example of receiving a request for a chunk
self.addEventListener('message', async (event) => {
    const { type, chunkAddress, offeredTokens } = event.data;
    if (type === 'requestBlock') {
        try {
            const chunkData = await chunks.get(chunkAddress);
            event.source.postMessage({ status: 200, chunkData });
        } catch {
            // Decide to fetch or deny
            const transaction = createTransaction(offeredTokens, 'peer');
            if (transaction.status === 'pending') {
                // Simulate fetching the chunk from peers
                try {
                    const fetchedChunk = await requestBlock(chunkAddress, offeredTokens);
                    event.source.postMessage({ status: 200, chunkData: fetchedChunk });
                    transaction.status = 'accepted';
                } catch {
                    transaction.status = 'declined';
                    event.source.postMessage({ status: 404 });
                }
            } else {
                event.source.postMessage({ status: 402 });
            }
        }
    }
});
