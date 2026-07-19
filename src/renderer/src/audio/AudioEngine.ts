import { EQ_FREQUENCIES } from '@shared/types'

/**
 * Graph: <audio> -> preamp -> 10 EQ bands -> balance -> volume -> analyser -> output
 *
 * The source is deliberately an HTMLAudioElement rather than decodeAudioData: the
 * browser streams the file itself and gives seeking for free, whereas
 * decodeAudioData would hold the entire decoded track in memory (~50 MB for five
 * minutes of audio).
 */
export class AudioEngine {
  readonly element: HTMLAudioElement

  private context: AudioContext | null = null
  private source: MediaElementAudioSourceNode | null = null
  private preampNode: GainNode | null = null
  private filters: BiquadFilterNode[] = []
  private pannerNode: StereoPannerNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  private eqEnabled = false
  private eqBands: number[] = new Array(EQ_FREQUENCIES.length).fill(0)
  private eqPreamp = 0

  constructor() {
    this.element = new Audio()
    this.element.preload = 'metadata'
    // crossOrigin is deliberately left unset: the audio is served from the same
    // origin as the page, and Chromium does not support CORS for custom schemes
    // at all — the attribute would only break loading.
  }

  /**
   * The AudioContext is created lazily: the browser blocks it until the first
   * user gesture, so there is no point building the graph in the constructor.
   */
  private ensureGraph(): void {
    if (this.context) return

    const context = new AudioContext()
    const source = context.createMediaElementSource(this.element)

    const preamp = context.createGain()
    preamp.gain.value = 1

    const filters = EQ_FREQUENCIES.map((frequency, index) => {
      const filter = context.createBiquadFilter()
      // The outer bands are shelves so that bass and treble lift as a whole
      // rather than as a narrow bell around the centre frequency.
      if (index === 0) {
        filter.type = 'lowshelf'
      } else if (index === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf'
      } else {
        filter.type = 'peaking'
        filter.Q.value = 1.4
      }
      filter.frequency.value = frequency
      filter.gain.value = 0
      return filter
    })

    const panner = context.createStereoPanner()
    const gain = context.createGain()
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.75

    source.connect(preamp)
    const tail = filters.reduce<AudioNode>((node, filter) => {
      node.connect(filter)
      return filter
    }, preamp)
    tail.connect(panner)
    panner.connect(gain)
    gain.connect(analyser)
    analyser.connect(context.destination)

    this.context = context
    this.source = source
    this.preampNode = preamp
    this.filters = filters
    this.pannerNode = panner
    this.gainNode = gain
    this.analyserNode = analyser

    this.applyEqualizer()
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode
  }

  /** Chromium suspends the AudioContext when the tab loses focus. */
  private async resumeContext(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume()
    }
  }

  async load(url: string): Promise<void> {
    this.ensureGraph()
    this.element.src = url
    this.element.load()
  }

  async play(): Promise<void> {
    this.ensureGraph()
    await this.resumeContext()
    await this.element.play()
  }

  pause(): void {
    this.element.pause()
  }

  stop(): void {
    this.element.pause()
    this.element.currentTime = 0
  }

  seek(seconds: number): void {
    if (Number.isFinite(this.element.duration)) {
      this.element.currentTime = Math.max(0, Math.min(seconds, this.element.duration))
    }
  }

  /** 0…1 */
  setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    // Hearing is logarithmic: a linear slider would sound as if all the volume
    // were crammed into the top quarter of its travel.
    const curved = clamped * clamped
    if (this.gainNode) {
      this.gainNode.gain.value = curved
    } else {
      this.element.volume = curved
    }
  }

  /** -1 (left) … +1 (right) */
  setBalance(value: number): void {
    if (this.pannerNode) {
      this.pannerNode.pan.value = Math.max(-1, Math.min(1, value))
    }
  }

  setEqualizerEnabled(enabled: boolean): void {
    this.eqEnabled = enabled
    this.applyEqualizer()
  }

  setEqualizerBands(bands: number[]): void {
    this.eqBands = bands
    this.applyEqualizer()
  }

  setEqualizerPreamp(preamp: number): void {
    this.eqPreamp = preamp
    this.applyEqualizer()
  }

  private applyEqualizer(): void {
    if (!this.preampNode) return

    const preampDb = this.eqEnabled ? this.eqPreamp : 0
    this.preampNode.gain.value = 10 ** (preampDb / 20)

    this.filters.forEach((filter, index) => {
      filter.gain.value = this.eqEnabled ? (this.eqBands[index] ?? 0) : 0
    })
  }

  destroy(): void {
    this.element.pause()
    this.element.removeAttribute('src')
    this.element.load()
    this.source?.disconnect()
    void this.context?.close()
    this.context = null
  }
}
