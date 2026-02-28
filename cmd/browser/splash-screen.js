export class SplashScreen extends HTMLElement {
  constructor() {
    super()
    this.hideTimer = null
    this.onOverlayClick = this.onOverlayClick.bind(this)
    this.onEnterClick = this.onEnterClick.bind(this)
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: block;
            opacity: 1;
            transition: opacity 220ms ease;
          }

          :host([data-hiding]) {
            opacity: 0;
            pointer-events: none;
          }

          .overlay {
            position: fixed;
            inset: 0;
            display: grid;
            place-items: center;
            background: #000;
          }

          .panel {
            position: relative;
            width: min(1200px, 100vw);
            height: min(900px, 100vh);
            overflow: hidden;
          }

          .background {
            position: absolute;
            inset: 0;
          }

          .background img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .content {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            color: #fff;
            font-family: 'Space Grotesk', sans-serif;
          }

          .title {
            width: min(600px, 80vw);
            height: auto;
          }

          .loader {
            width: min(360px, 80vw);
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .loader-track {
            position: relative;
            height: 8px;
            border: 1px solid rgba(255, 255, 255, 0.4);
            background: rgba(0, 0, 0, 0.35);
            overflow: hidden;
          }

          .loader-bar {
            width: 45%;
            height: 100%;
            background: linear-gradient(90deg, #56d9ff 0%, #ffffff 100%);
            animation: loading 1.1s ease-in-out infinite;
          }

          .loader-text {
            font-size: 14px;
            letter-spacing: 0.05em;
            text-align: center;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
          }

          .enter {
            padding: 10px 24px;
            border: 1px solid rgba(255, 255, 255, 0.7);
            background: rgba(0, 0, 0, 0.55);
            color: #fff;
            font-family: inherit;
            font-size: 14px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            opacity: 0.5;
          }

          .enter:disabled {
            cursor: not-allowed;
          }

          :host([data-ready]) .enter {
            opacity: 1;
          }

          :host([data-ready]) .loader-bar {
            width: 100%;
            animation: none;
            transform: translateX(0);
          }

          .version {
            position: absolute;
            right: 16px;
            bottom: 12px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
          }

          @keyframes loading {
            0% {
              transform: translateX(-140%);
            }

            100% {
              transform: translateX(280%);
            }
          }
        </style>

        <div class="overlay" part="overlay">
          <div class="panel" part="panel">
            <div class="background">
              <img src="/splash/background.svg" alt="" aria-hidden="true">
            </div>
            <div class="content">
              <img src="/splash/title.svg" class="title" alt="GAMS - Game Asset Management System" width="600" height="200">
              <div class="loader">
                <div class="loader-track">
                  <div class="loader-bar"></div>
                </div>
                <span class="loader-text">Loading...</span>
              </div>
              <button class="enter" disabled>Enter</button>
              <span class="version">v0.1.0</span>
            </div>
          </div>
        </div>
      `
    }

    this.overlayEl = this.shadowRoot.querySelector('.overlay')
    this.enterButtonEl = this.shadowRoot.querySelector('.enter')
    this.statusTextEl = this.shadowRoot.querySelector('.loader-text')

    this.overlayEl?.addEventListener('click', this.onOverlayClick)
    this.enterButtonEl?.addEventListener('click', this.onEnterClick)
  }

  disconnectedCallback() {
    this.overlayEl?.removeEventListener('click', this.onOverlayClick)
    this.enterButtonEl?.removeEventListener('click', this.onEnterClick)
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }

  setStatus(message) {
    if (!this.statusTextEl) return
    this.statusTextEl.textContent = message
  }

  markReady() {
    this.setAttribute('data-ready', '')
    if (this.enterButtonEl) this.enterButtonEl.disabled = false
    this.setStatus('Ready')
  }

  dismiss() {
    if (this.hasAttribute('data-hiding')) return
    this.setAttribute('data-hiding', '')
    this.hideTimer = setTimeout(() => this.remove(), 240)
  }

  onOverlayClick(event) {
    if (!this.hasAttribute('data-ready')) return
    if (event.target === this.overlayEl) this.dismiss()
  }

  onEnterClick() {
    if (!this.hasAttribute('data-ready')) return
    this.dismiss()
  }
}

customElements.define('splash-screen', SplashScreen)
