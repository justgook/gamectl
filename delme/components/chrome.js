/**
 * GameCtl Chrome Component
 * Panel header with view selector and close button
 */

import { subscribeTokens, getTokens } from '../shared/tokens.js';

class GameCtlChrome extends HTMLElement {
  static get observedAttributes() {
    return ['x', 'y', 'width', 'height'];
  }
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._views = [];
    this._currentViewType = 'empty';
    this._onViewChange = null;
    this._onClose = null;
    this._canClose = true;
  }
  
  connectedCallback() {
    this._unsubscribeTokens = subscribeTokens(tokens => {
      this.render(tokens);
    });
    this.updatePosition();
  }
  
  disconnectedCallback() {
    this._unsubscribeTokens?.();
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (['x', 'y', 'width', 'height'].includes(name)) {
      this.updatePosition();
    }
  }
  
  updatePosition() {
    const x = this.getAttribute('x') || '0';
    const y = this.getAttribute('y') || '0';
    const width = this.getAttribute('width') || '100';
    
    this.style.position = 'absolute';
    this.style.left = x + 'px';
    this.style.top = y + 'px';
    this.style.width = width + 'px';
    this.style.height = '30px';
    this.style.zIndex = '1000';
  }
  
  setViews(views) {
    this._views = views;
    this.render(getTokens());
  }
  
  setCurrentView(viewType) {
    this._currentViewType = viewType;
    this.render(getTokens());
  }
  
  setCanClose(canClose) {
    this._canClose = canClose;
    this.render(getTokens());
  }
  
  onViewChange(callback) {
    this._onViewChange = callback;
  }
  
  onClose(callback) {
    this._onClose = callback;
  }
  
  render(tokens) {
    if (!tokens) return;
    
    // Use design tokens
    const bg = tokens['color-semantic'].background['panel-header'];
    const borderColor = tokens['color-semantic'].border.default;
    const textColor = tokens['color-semantic'].text.accent;
    const textPrimary = tokens['color-semantic'].text.primary;
    const accentColor = tokens['color-semantic'].background['accent-default'];
    const accentHover = tokens['color-semantic'].background['accent-hover'];
    const dangerColor = tokens['color-semantic'].background.danger;
    const interactiveActive = tokens['color-semantic'].background['interactive-active'];
    const interactiveHover = tokens['color-semantic'].background['interactive-hover'];
    const textSecondary = tokens['color-semantic'].text.secondary;
    const spacing = tokens.spacing['scale-3'];
    const borderRadius = tokens.border.radius.sm;
    const fontSize = tokens.font.size.sm;
    const fontFamily = tokens.font.family.ui;
    const fontWeight = tokens.font.weight.medium;
    const glowAccent = tokens.shadow['glow-accent'];
    
    // Build shadow string
    const shadowStr = `${glowAccent.offsetX} ${glowAccent.offsetY} ${glowAccent.blur} ${glowAccent.spread} ${glowAccent.color}`;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          pointer-events: none;
        }
        
        .header {
          pointer-events: auto;
          display: flex;
          gap: ${spacing};
          align-items: center;
          background: ${bg};
          border-bottom: 1px solid ${borderColor};
          padding: ${spacing};
          height: 30px;
          box-sizing: border-box;
        }
        
        .view-selector {
          flex: 1;
          background: ${interactiveActive};
          color: ${textColor};
          border: 1px solid ${borderColor};
          padding: 4px ${spacing};
          padding-right: 28px;
          border-radius: ${borderRadius};
          font-size: ${fontSize};
          font-family: ${fontFamily};
          font-weight: ${fontWeight};
          cursor: pointer;
          appearance: none;
          background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="${encodeURIComponent(textColor)}" d="M6 9L1 4h10z"/></svg>');
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 12px;
          transition: all 0.2s ease;
        }
        
        .view-selector:hover {
          border-color: ${accentColor};
          box-shadow: 0 0 0 1px ${accentColor};
        }
        
        .view-selector:focus {
          outline: none;
          box-shadow: ${shadowStr};
        }
        
        .close-btn {
          background: ${dangerColor};
          color: ${textPrimary};
          border: none;
          width: 24px;
          height: 24px;
          border-radius: ${borderRadius};
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0;
          transition: all 0.2s ease;
        }
        
        .close-btn:hover:not(:disabled) {
          filter: brightness(0.8);
          box-shadow: ${shadowStr};
        }
        
        .close-btn:disabled {
          background: ${interactiveHover};
          color: ${textSecondary};
          cursor: not-allowed;
          opacity: 0.5;
        }
      </style>
      
      <div class="header">
        <select class="view-selector">
          ${this._views.map(v => `
            <option value="${v.id}" ${v.id === this._currentViewType ? 'selected' : ''}>
              ${v.name}
            </option>
          `).join('')}
        </select>
        <button class="close-btn" ${!this._canClose ? 'disabled' : ''} title="${!this._canClose ? 'Cannot close last panel' : 'Close panel'}">×</button>
      </div>
    `;
    
    // Event listeners
    const selector = this.shadowRoot.querySelector('.view-selector');
    selector?.addEventListener('change', (e) => {
      if (this._onViewChange) {
        this._onViewChange(e.target.value);
      }
    });
    
    const closeBtn = this.shadowRoot.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => {
      if (this._canClose && this._onClose) {
        this._onClose();
      }
    });
  }
}

customElements.define('gamectl-chrome', GameCtlChrome);
export default GameCtlChrome;
