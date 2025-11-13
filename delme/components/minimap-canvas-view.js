/**
 * GameCtl Minimap Canvas View Component (Wrapper)
 * 
 * NOTE: This is a temporary wrapper component that delegates to the existing
 * MinimapCanvasView class. This allows us to integrate the new component system
 * while keeping the complex canvas rendering logic intact.
 * 
 * TODO: Fully port GridCanvasView and MinimapCanvasView to web components
 */

import GameCtlBaseView from './base-view.js';

class GameCtlMinimapCanvasView extends GameCtlBaseView {
  constructor() {
    super();
    this.tilemapKey = 'minimap'; // Default tilemap key
    this.wrappedView = null;
    this.containerDiv = null;
  }
  
  connectedCallback() {
    super.connectedCallback();
    
    // Create container for the old view
    this.containerDiv = document.createElement('div');
    this.containerDiv.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    `;
    this.shadowRoot.appendChild(this.containerDiv);
    
    // Set panel ID for the wrapped view
    const panelId = this.getAttribute('data-panel-id');
    if (panelId) {
      this.containerDiv.dataset.panelId = panelId;
    }
    
    // Initialize wrapped view if we have plugin manager
    if (this.pluginManager) {
      this.initializeWrappedView();
    } else {
      // Wait for plugin manager to be set
      console.log('MinimapCanvasView: Waiting for plugin manager...');
    }
  }
  
  disconnectedCallback() {
    if (this.wrappedView) {
      this.wrappedView.destroy();
      this.wrappedView = null;
    }
    super.disconnectedCallback();
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    
    // Update wrapped view if it exists
    if (this.wrappedView && this.wrappedView.updatePosition) {
      this.wrappedView.updatePosition();
    }
  }
  
  /**
   * Called when context properties are set (pluginManager, ide, layoutManager)
   */
  setContext(context) {
    if (context.pluginManager) {
      this.pluginManager = context.pluginManager;
    }
    if (context.ide) {
      this.ide = context.ide;
    }
    if (context.layoutManager) {
      this.layoutManager = context.layoutManager;
    }
    
    // Initialize wrapped view if we have the required context
    if (this.pluginManager && !this.wrappedView) {
      this.initializeWrappedView();
    }
  }
  
  onResize(width, height) {
    if (this.wrappedView) {
      this.wrappedView.onResize(width, height);
    }
  }
  
  initializeWrappedView() {
    // This will be called once plugin manager is set
    if (!this.pluginManager || this.wrappedView) return;
    
    // Ensure container exists
    if (!this.containerDiv) {
      this.containerDiv = document.createElement('div');
      this.containerDiv.style.cssText = `
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      `;
      this.shadowRoot.appendChild(this.containerDiv);
    }
    
    // We need to wait for the old MinimapCanvasView class to be available
    if (typeof MinimapCanvasView === 'undefined') {
      console.warn('MinimapCanvasView class not loaded yet');
      // Try again in a moment
      setTimeout(() => this.initializeWrappedView(), 100);
      return;
    }
    
    // Use real panel ID and layout system from context
    const panelId = this.getAttribute('data-panel-id') || `minimap-${Date.now()}`;
    
    // Create a real layout system that uses our current position
    const realLayoutSystem = {
      bb: () => ({
        x1: parseInt(this.getAttribute('x') || '0'),
        y1: parseInt(this.getAttribute('y') || '0'),
        x2: parseInt(this.getAttribute('x') || '0') + parseInt(this.getAttribute('width') || '800'),
        y2: parseInt(this.getAttribute('y') || '0') + parseInt(this.getAttribute('height') || '600')
      })
    };
    
    const context = {
      pluginManager: this.pluginManager,
      ide: this.ide,
      layoutManager: this.layoutManager
    };
    
    // Create wrapped view
    this.wrappedView = new MinimapCanvasView(
      panelId,
      realLayoutSystem,
      context,
      this.tilemapKey
    );
    
    // Render it into our container
    console.log('About to render, containerDiv:', this.containerDiv);
    this.wrappedView.render(this.containerDiv);
    
    console.log('✅ MinimapCanvasView wrapper initialized');
  }
  
  render() {
    // The wrapped view handles its own rendering
    // We just need to make sure it's initialized
    if (!this.wrappedView) {
      this.showFallbackUI();
    }
    this.initializeWrappedView();
  }
  
  showFallbackUI() {
    if (!this.containerDiv) return;
    
    this.containerDiv.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #1e1e1e;
        color: #888;
        font-family: sans-serif;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="font-size: 16px; margin-bottom: 10px;">🎮 Minimap Canvas</div>
        <div style="font-size: 12px; margin-bottom: 20px;">Loading minimap view...</div>
        <div style="font-size: 10px; color: #666;">
          If this persists, check console for errors
        </div>
      </div>
    `;
  }
  
  onTokensChanged(tokens) {
    // The old view doesn't use tokens, so we don't need to do anything
    // When we fully port this view, we'll use tokens for styling
  }
}

customElements.define('gamectl-minimap-canvas-view', GameCtlMinimapCanvasView);
export default GameCtlMinimapCanvasView;
