const initializeSSEChannel = async function () {
    this.channel = new EventSource(this.config.url, { withCredentials: this.config.withCredentials })
    this.channel.addEventListener('message', event => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data })))
    this.channel.addEventListener('error', () => reopenSSEChannel.call(this))
}, reopenSSEChannel = async function () {
    (typeof requestIdleCallback === 'function') ? requestIdleCallback(() => initializeSSEChannel.call(this, config)) : setTimeout(() => initializeSSEChannel.call(this, config), 1000)
}, initializeWebSocket = async function (config) {
    this.channel = new WebSocket(config.url, config.protocols ?? [])
    this.channel.addEventListener('message', event => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data })))
    this.channel.addEventListener('close', () => reopenWebSocket.call(this, config))
    this.channel.addEventListener('error', () => reopenWebSocket.call(this, config))
}, reopenWebSocket = async function (config) {
    (typeof requestIdleCallback === 'function') ? requestIdleCallback(() => initializeWebSocket.call(this, config)) : setTimeout(() => initializeWebSocket.call(this, config), 1000)
}, initializeWebTransportChannel = async function (config) {
    this.channel = new WebTransport(config.url)
    this.channel.ready.then(() => {
        this.channel.datagrams.readable.pipeTo(new WritableStream({
            write: (data) => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: data }))
        }))
    }).catch((error) => {
        this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: error.message }))
        reopenWebTransportChannel.call(this, config)
    })
}, reopenWebTransportChannel = async function (config) {
    (typeof requestIdleCallback === 'function') ? requestIdleCallback(() => initializeWebTransportChannel.call(this, config)) : setTimeout(() => initializeWebTransportChannel.call(this, config), 1000)
}, waitForWebSocketReady = async function () {
    return new Promise((resolve, reject) => {
        if (this.channel.readyState === 1) resolve()
        else {
            this.channel = new WebSocket(this.config.url)
            this.channel.addEventListener('open', resolve())
            this.channel.addEventListener('error', event => {
                this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: event.message }))
                reject()
            })
        }
    })
}, waitForWebTransportReady = async function () {
    if (this.channel.readyState === 'connected') return
    await this.channel.ready
}


let localStream, dataChannel

export default {
    send: async function (message) {
        switch (this.type) {
            case 'broadcast': this.channel.postMessage(message); break
            case 'messaging': this.channel.port1.postMessage(message); break
            case 'sse': break
            case 'websocket':
                if (this.channel.readyState !== 1) await waitForWebSocketReady.call(this)
                this.channel.send(message)
                break
            case 'webtransport':
                if (this.channel.readyState !== 'connected') await waitForWebTransportReady.call(this)
                const writer = this.channel.datagrams.writable.getWriter()
                await writer.write(message)
                writer.releaseLock()
                break;
            case 'webrtc': if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(message); break
        }
    },
    stop: async function () {
        if (localStream) localStream.getTracks().forEach(track => track.stop())
        this.eventTarget.dispatchEvent(new CustomEvent('stop'))
    },
    pause: async function () {
        if (localStream) localStream.getTracks().forEach(track => track.enabled = false)
        this.eventTarget.dispatchEvent(new CustomEvent('pause'))
    },
    resume: async function () {
        if (localStream) localStream.getTracks().forEach(track => track.enabled = true)
        this.eventTarget.dispatchEvent(new CustomEvent('resume'))
    },
    initializeBroadcastChannel: async function () {
        this.channel = new BroadcastChannel(this.config.name ?? this.name)
        this.channel.addEventListener('message', event => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data })))
    },
    initializeSSEChannel, reopenSSEChannel, initializeWebSocket, reopenWebSocket,
    initializeWebTransportChannel, reopenWebTransportChannel,
    initializeWebRTCChannel: async function (config) {
        this.channel = new RTCPeerConnection(config)
        const signalingChannel = config.signalingChannel instanceof Channel ? config.signalingChannel : new Channel(config.signalingChannel)
        signalingChannel.eventTarget.addEventListener('message', async (event) => {
            const data = event.detail
            if (data.offer) {
                await this.channel.setRemoteDescription(new RTCSessionDescription(data.offer))
                const answer = await this.channel.createAnswer()
                await this.channel.setLocalDescription(answer)
                signalingChannel.send({ answer })
            } else if (data.answer) await this.channel.setRemoteDescription(new RTCSessionDescription(data.answer))
            else if (data.candidate) await this.channel.addIceCandidate(new RTCIceCandidate(data.candidate))
        })
        this.channel.addEventListener('icecandidate', (event) => { if (event.candidate) signalingChannel.send({ candidate: event.candidate }) })
        dataChannel = this.channel.createDataChannel("dataChannel")
        dataChannel.addEventListener('open', () => { this.eventTarget.dispatchEvent(new CustomEvent('open')) })
        dataChannel.addEventListener('message', event => { this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data })) })
        dataChannel.addEventListener('close', () => { this.eventTarget.dispatchEvent(new CustomEvent('close')) })
        dataChannel.addEventListener('error', event => { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: event.message })) })
    },
    initializeMedia: async function () {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: this.config.video ?? false, audio: this.config.audio ?? false })
            localStream.getTracks().forEach(track => this.channel.addTrack(track, localStream))
            this.eventTarget.dispatchEvent(new CustomEvent('start', { detail: localStream }))
        } catch (error) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: error.message })) }
    },
    waitForWebSocketReady, waitForWebTransportReady
}