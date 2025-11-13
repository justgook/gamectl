/**
 * GameCtl Base View Component
 * Base class for all view custom elements
 */

import { subscribeTokens, getTokens } from '../shared/tokens.js';

class GameCtlBaseView extends HTMLElement {
  // Standard position attributes
  static get observedAttributes() {
    return ['x', 'y', 'width', 'height'];
  }
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._unsubscribeTokens = null;
    
    // Context references (set by LayoutManager)
    this.pluginManager = null;
    this.ide = null;
  }
  
  connectedCallback() {
    // Subscribe to design tokens
    this._unsubscribeTokens = subscribeTokens(tokens => {
      this.onTokensChanged(tokens);
    });
    
    // Apply initial position
    this.updatePosition();
    
    // Render content
    this.render();
  }
  
  disconnectedCallback() {
    this._unsubscribeTokens?.();
    this.cleanup();
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected) return;
    
    switch(name) {
      case 'x':
        this.style.left = newValue + 'px';
        break;
      case 'y':
        this.style.top = newValue + 'px';
        break;
      case 'width':
        this.style.width = newValue + 'px';
        this.onResize(parseInt(newValue), parseInt(this.getAttribute('height') || '0'));
        break;
      case 'height':
        this.style.height = newValue + 'px';
        this.onResize(parseInt(this.getAttribute('width') || '0'), parseInt(newValue));
        break;
    }
  }
  
  updatePosition() {
    const x = this.getAttribute('x') || '0';
    const y = this.getAttribute('y') || '0';
    const width = this.getAttribute('width') || '100';
    const height = this.getAttribute('height') || '100';
    
    this.style.position = 'absolute';
    this.style.left = x + 'px';
    this.style.top = y + 'px';
    this.style.width = width + 'px';
    this.style.height = height + 'px';
  }
  
  /**
   * Override in subclasses to render view content
   */
  render() {
    // Implement in subclass
  }
  
  /**
   * Called when design tokens change
   * Override in subclass if needed
   * @param {Object} tokens - Current design tokens
   */
  onTokensChanged(tokens) {
    // Default: trigger re-render
    this.render();
  }
  
  /**
   * Called when view is resized
   * Override in subclass if needed (e.g., canvas resize)
   * @param {number} width - New width
   * @param {number} height - New height
   */
  onResize(width, height) {
    // Implement in subclass if needed
  }
  
  /**
   * Cleanup view resources
   * Override in subclass if needed
   */
  cleanup() {
    // Implement in subclass if needed
  }
  
  /**
   * Helper: Convert shadow token to CSS string
   * @param {Object} shadow - Shadow token object
   * @returns {string} CSS shadow string
   */
  getShadowString(shadow) {
    if (!shadow) return 'none';
    return `${shadow.offsetX} ${shadow.offsetY} ${shadow.blur} ${shadow.spread} ${shadow.color}`;
  }
  
  /**
   * Helper: Get current tokens
   * @returns {Object|null} Current design tokens
   */
  getTokens() {
    return getTokens();
  }
}

customElements.define('gamectl-base-view', GameCtlBaseView);
export default GameCtlBaseView;
