export default {
    send: async function (message) {
        switch (this.type) {
            case 'broadcast': this.channel.postMessage(message); break
            case 'messaging': this.channel.port1.postMessage(message); break
            case 'sse': break
            case 'websocket':
                if (this.channel.readyState !== 1) await this.#waitForWebSocketReady()
                this.channel.send(message)
                break
            case 'webtransport':
                if (this.channel.readyState !== 'connected') await this.#waitForWebTransportReady()
                const writer = this.channel.datagrams.writable.getWriter()
                await writer.write(message)
                writer.releaseLock()
                break;
            case 'webrtc': if (this.#dataChannel && this.#dataChannel.readyState === 'open') this.#dataChannel.send(message); break
        }
    }
}