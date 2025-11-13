/**
 * GameCtl Tilemap Inspector View Component
 * Display tilemap structure (layers, metadata)
 */

import GameCtlBaseView from './base-view.js';

class GameCtlTilemapInspectorView extends GameCtlBaseView {
  constructor() {
    super();
    this.tilemap = null;
    this.tilemapKey = 'minimap'; // Default tilemap key
    this.loadingInProgress = false;
  }
  
  connectedCallback() {
    super.connectedCallback();
    
    // Register with IDE to receive refresh calls
    if (this.ide) {
      this.ide.registerTilemapInspector(this);
    }

    // Load tilemap data after a short delay
    setTimeout(() => this.loadTilemapList(), 100);
  }

  disconnectedCallback() {
    // Unregister from IDE
    if (this.ide) {
      this.ide.unregisterTilemapInspector(this);
    }
    
    super.disconnectedCallback();
  }
  
  render() {
    const t = this.getTokens();
    if (!t) return;
    
    const bgPanel = t['color-semantic'].background.panel;
    const textPrimary = t['color-semantic'].text.primary;
    const textSecondary = t['color-semantic'].text.secondary;
    const textAccent = t['color-semantic'].text.accent;
    const borderColor = t['color-semantic'].border.default;
    const interactiveActive = t['color-semantic'].background['interactive-active'];
    const interactiveHover = t['color-semantic'].background['interactive-hover'];
    const accentBg = t['color-semantic'].background['accent-default'];
    const spacing = {
      sm: t.spacing['scale-2'],
      md: t.spacing['scale-3'],
      lg: t.spacing['scale-4'],
      xl: t.spacing['scale-5']
    };
    const borderRadius = t.border.radius.sm;
    const fontHeading = t['font-semantic'].heading.default;
    const fontBody = t['font-semantic'].body.default;
    const fontSmall = t['font-semantic'].body.small;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          background: ${bgPanel};
          overflow-y: auto;
        }
        
        .container {
          padding: ${spacing.lg};
          padding-top: ${spacing.xl};
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${spacing.lg};
        }
        
        h2 {
          margin: 0;
          font-family: ${fontHeading.fontFamily};
          font-size: ${fontHeading.fontSize};
          font-weight: ${fontHeading.fontWeight};
          color: ${textAccent};
        }
        
        .controls-row {
          display: flex;
          gap: ${spacing.md};
          align-items: center;
          margin-bottom: ${spacing.lg};
        }
        
        .controls-row label {
          font-size: ${fontBody.fontSize};
          font-family: ${fontBody.fontFamily};
          font-weight: ${fontBody.fontWeight};
          color: ${textSecondary};
        }
        
        .tilemap-selector {
          flex: 1;
          background: ${interactiveActive};
          color: ${textAccent};
          border: 1px solid ${borderColor};
          padding: ${spacing.sm} ${spacing.md};
          padding-right: 28px;
          border-radius: ${borderRadius};
          font-size: ${fontSmall.fontSize};
          font-family: ${fontBody.fontFamily};
          font-weight: ${fontBody.fontWeight};
          cursor: pointer;
          appearance: none;
          background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="${encodeURIComponent(textAccent)}" d="M6 9L1 4h10z"/></svg>');
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 12px;
          transition: all 0.2s ease;
        }
        
        .tilemap-selector:hover {
          background: ${interactiveHover};
          border-color: ${accentBg};
        }
        
        .refresh-btn {
          padding: ${spacing.sm} ${spacing.md};
          background: ${accentBg};
          color: ${textPrimary};
          border: none;
          border-radius: ${borderRadius};
          cursor: pointer;
          font-size: ${fontSmall.fontSize};
          font-family: ${fontBody.fontFamily};
          font-weight: ${fontBody.fontWeight};
          transition: all 0.2s ease;
        }
        
        .refresh-btn:hover:not(:disabled) {
          filter: brightness(1.2);
          box-shadow: ${this.getShadowString(t.shadow['glow-accent-faint'])};
        }
        
        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }
        
        .tilemap-content {
          background: ${interactiveActive};
          border: 1px solid ${borderColor};
          border-radius: ${borderRadius};
          padding: ${spacing.lg};
        }
        
        .empty-state {
          color: ${textSecondary};
          font-style: italic;
          text-align: center;
          padding: ${spacing.xl};
        }
        
        .layer-item {
          margin-bottom: ${spacing.lg};
          padding: ${spacing.md};
          background: ${bgPanel};
          border: 1px solid ${borderColor};
          border-radius: ${borderRadius};
        }
        
        .layer-title {
          font-size: ${fontBody.fontSize};
          font-weight: ${fontBody.fontWeight};
          color: ${textAccent};
          margin-bottom: ${spacing.sm};
        }
        
        .meta-item {
          font-size: ${fontSmall.fontSize};
          color: ${textSecondary};
          margin: ${spacing.sm} 0;
          font-family: 'Courier New', monospace;
        }
        
        .meta-key {
          color: ${textAccent};
        }
      </style>
      
      <div class="container">
        <div class="header">
          <h2>Tilemap Inspector</h2>
        </div>
        
        <div class="controls-row">
          <label>Map:</label>
          <select class="tilemap-selector">
            <option value="">Loading...</option>
          </select>
          <button class="refresh-btn">Refresh</button>
        </div>
        
        <div class="tilemap-content">
          ${this.renderTilemapContent()}
        </div>
      </div>
    `;
    
    // Event listeners
    const selector = this.shadowRoot.querySelector('.tilemap-selector');
    selector?.addEventListener('change', (e) => this.loadTilemap(e.target.value));
    
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    refreshBtn?.addEventListener('click', () => this.refresh());
  }
  
  renderTilemapContent() {
    if (!this.tilemap) {
      return '<div class="empty-state">No tilemap loaded. Select a map or click Refresh.</div>';
    }
    
    let html = '';
    
    // Render metadata
    if (this.tilemap.meta) {
      html += '<div class="layer-item">';
      html += '<div class="layer-title">Metadata</div>';
      for (const [key, value] of Object.entries(this.tilemap.meta)) {
        html += `<div class="meta-item"><span class="meta-key">${key}:</span> ${value}</div>`;
      }
      html += '</div>';
    }
    
    // Render layers
    if (this.tilemap.layers && this.tilemap.layers.length > 0) {
      this.tilemap.layers.forEach((layer, index) => {
        html += '<div class="layer-item">';
        html += `<div class="layer-title">Layer ${index}</div>`;
        html += `<div class="meta-item"><span class="meta-key">width:</span> ${layer.width || 0}</div>`;
        html += `<div class="meta-item"><span class="meta-key">tiles:</span> ${layer.data?.length || 0}</div>`;
        
        if (layer.meta) {
          for (const [key, value] of Object.entries(layer.meta)) {
            html += `<div class="meta-item"><span class="meta-key">${key}:</span> ${value}</div>`;
          }
        }
        html += '</div>';
      });
    }
    
    return html;
  }
  
  async loadTilemapList() {
    if (!this.pluginManager) return;
    
    try {
      const result = await this.pluginManager.call('tilemap-storage', 'list', JSON.stringify({}));
      const output = new TextDecoder().decode(result.output);
      const data = JSON.parse(output);
      
      // Handle both array and object responses
      const tilemaps = Array.isArray(data) ? data : (data.maps || []);
      
      const selector = this.shadowRoot.querySelector('.tilemap-selector');
      if (selector) {
        if (tilemaps.length === 0) {
          selector.innerHTML = '<option value="">No tilemaps available</option>';
        } else {
          selector.innerHTML = tilemaps.map(key => 
            `<option value="${key}" ${key === this.tilemapKey ? 'selected' : ''}>${key}</option>`
          ).join('');
          
          // Load default tilemap if available
          if (tilemaps.includes(this.tilemapKey)) {
            this.loadTilemap(this.tilemapKey);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load tilemap list:', error);
    }
  }
  
  async loadTilemap(key, retryCount = 0) {
    if (!this.pluginManager || !key) {
        this.loadingInProgress = false;
        return;
    }

    this.tilemapKey = key;
    
    if (retryCount === 0) {
        this.loadingInProgress = true;
        const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
        if (refreshBtn) refreshBtn.disabled = true;
    }

    try {
      const input = JSON.stringify({ id: key });
      const result = await this.pluginManager.call('tilemap-storage', 'get', input);

      if (result.returnCode !== 0) {
        throw new Error(`Tilemap '${key}' not found in storage.`);
      }

      const output = new TextDecoder().decode(result.output);
      
      if (!output || output.trim() === '') {
        throw new Error('Incomplete JSON data (empty response)');
      }
      
      const trimmedOutput = output.trim();
      if (!(trimmedOutput.startsWith('{') && trimmedOutput.endsWith('}')) && !(trimmedOutput.startsWith('[') && trimmedOutput.endsWith(']'))) {
          throw new Error('Incomplete JSON data (race condition detected)');
      }

      this.tilemap = JSON.parse(output);
      this.loadingInProgress = false;
      this.render();

    } catch (error) {
      console.error(`Failed to load tilemap (attempt ${retryCount + 1}):`, error.message);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 150; // 150ms, 300ms, 600ms
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.loadTilemap(key, retryCount + 1); // Await the recursive call
        return;
      }
      
      console.error(`Failed to load tilemap '${key}' after multiple retries.`);
      this.tilemap = null;
      this.loadingInProgress = false;
      this.render(); // Render empty state on final failure
    } finally {
      if (!this.loadingInProgress) {
        const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }
  }
  
  async refresh() {
    await this.loadTilemapList();
    if (this.tilemapKey) {
      await this.loadTilemap(this.tilemapKey);
    }
  }
}

customElements.define('gamectl-tilemap-inspector-view', GameCtlTilemapInspectorView);
export default GameCtlTilemapInspectorView;
