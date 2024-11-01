const handleServiceWorkerStateChange = async function (worker) {
    if (worker.state === 'activated') worker.onmessage = (event) => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data }))
}

export default {
    send: async function (message) {
        switch (this.type) {
            case 'web': case 'shared': this.worker.postMessage(message); break
            case 'service': navigator.serviceWorker.controller?.postMessage(message); break
        }
    },
    initializeWebWorker: async function (config) {
        this.worker = new Worker(config.url)
        this.worker.onmessage = (event) => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data }))
        this.worker.onerror = (event) => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: event.message }))
    },
    initializeSharedWorker: async function (config) {
        this.worker = new SharedWorker(config.url)
        this.worker.port.start()
        this.worker.port.onmessage = (event) => this.eventTarget.dispatchEvent(new CustomEvent('message', { detail: event.data }))
        this.worker.port.onerror = (event) => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: event.message }))
    },

    initializeServiceWorker: async function (config) {
        navigator.serviceWorker.register(config.url).then(reg => {
            if (reg.installing) reg.installing.onstatechange = () => handleServiceWorkerStateChange.call(this, reg.installing)
            else if (reg.waiting) handleServiceWorkerStateChange.call(this, reg.waiting)
            else if (reg.active) handleServiceWorkerStateChange.call(this, reg.active)
        }).catch(err => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })))
    },
    initializeCSSWorklet: async function (config) {
        try {
            if (typeof CSS !== 'undefined' && CSS.paintWorklet) CSS.paintWorklet.addModule(config.url)
                .then(() => this.eventTarget.dispatchEvent(new CustomEvent('ready')))
                .catch(err => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })))
        } catch (err) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) }
    },
    initializeAudioWorklet: async function (config) {
        try {
            const audioContext = config.audioContext ?? new AudioContext()
            audioContext.audioWorklet.addModule(config.url).then(() => {
                this.worker = new AudioWorkletNode(audioContext, config.processor)
                this.eventTarget.dispatchEvent(new CustomEvent('ready'))
            }).catch(err => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })))
        } catch (err) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) }
    },
    initializeAnimationWorklet: async function (config) {
        try {
            if (typeof CSS !== 'undefined' && CSS.animationWorklet) CSS.animationWorklet.addModule(config.url)
                .then(() => this.eventTarget.dispatchEvent(new CustomEvent('ready')))
                .catch(err => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })))
        } catch (err) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) }
    },
    initializeLayoutWorklet: async function (config) {
        try {
            if (typeof CSS !== 'undefined' && CSS.layoutWorklet) CSS.layoutWorklet.addModule(config.url)
                .then(() => this.eventTarget.dispatchEvent(new CustomEvent('ready')))
                .catch(err => this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })))
        } catch (err) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) }
    },
    initializeVideoWorklet: async function (config) {
        try {
            const videoContext = config.videoContext ?? new VideoContext()
            videoContext.videoWorklet.addModule(config.url).then(() => {
                this.worker = new VideoWorkletNode(videoContext, config.processor)
                this.eventTarget.dispatchEvent(new CustomEvent('ready'))
            }).catch(err => { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) })
        } catch (err) { this.eventTarget.dispatchEvent(new CustomEvent('error', { detail: err.message })) }
    }
}