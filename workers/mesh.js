self.addEventListener('install', (event) => {
    console.log('Element Mesh Service Worker installed.')
    event.waitUntil(self.skipWaiting())
});

self.addEventListener('activate', (event) => {
    console.log('Element Mesh Service Worker activated.')
    event.waitUntil(self.clients.claim())
})

const blocks = new Map()

// Responding to fetch events to serve blocks
self.addEventListener('fetch', async (event) => {
    const url = new URL(event.request.url);

    if (url.protocol === 'e:') {
        const blockAddress = url.pathname.split('/')[1];
        if (blocks.has(blockAddress)) {
            const blockData = blocks.get(blockAddress)
            event.respondWith(new Response(blockData))
        } else {
            event.respondWith(new Response('Block not found', { status: 404 }))
        }
    }
});

// Syncing between peers
async function syncWithPeers() {
    // Logic to sync blocks with other peers, either through WebRTC, WebSockets, or other protocols.
}

async function addBlock(block) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(block))
    const blockAddress = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
    blocks.set(blockAddress, block)
    return blockAddress
}
