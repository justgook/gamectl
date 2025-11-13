/**
 * GameCtl Console View Component
 * Display log messages from plugins
 */

import GameCtlBaseView from './base-view.js';

class GameCtlConsoleView extends GameCtlBaseView {
  constructor() {
    super();
    this.logs = [];
  }
  
  connectedCallback() {
    super.connectedCallback();
    
    // Register with IDE to receive logs (if available)
    if (this.ide) {
      this.ide.registerConsoleView(this);
    }
  }
  
  disconnectedCallback() {
    // Unregister from IDE
    if (this.ide) {
      this.ide.unregisterConsoleView(this);
    }
    
    super.disconnectedCallback();
  }
  
  render() {
    const t = this.getTokens();
    if (!t) return;
    
    // Extract tokens
    const bgPanel = t['color-semantic'].background.panel;
    const bgPanelHeader = t['color-semantic'].background['panel-header'];
    const textPrimary = t['color-semantic'].text.primary;
    const textSecondary = t['color-semantic'].text.secondary;
    const textAccent = t['color-semantic'].text.accent;
    const borderColor = t['color-semantic'].border.default;
    const dangerBg = t['color-semantic'].background.danger;
    const interactiveActive = t['color-semantic'].background['interactive-active'];
    const spacing = {
      sm: t.spacing['scale-2'],
      md: t.spacing['scale-3'],
      lg: t.spacing['scale-4'],
      xl: t.spacing['scale-5']
    };
    const borderRadius = t.border.radius.sm;
    const fontBody = t['font-semantic'].body.default;
    const fontSmall = t['font-semantic'].body.small;
    const fontHeading = t['font-semantic'].heading.default;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          overflow: hidden;
          background: ${bgPanel};
        }
        
        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: ${spacing.lg};
          box-sizing: border-box;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${spacing.md};
          padding-bottom: ${spacing.sm};
          border-bottom: 1px solid ${borderColor};
        }
        
        h2 {
          margin: 0;
          font-family: ${fontHeading.fontFamily};
          font-size: ${fontHeading.fontSize};
          font-weight: ${fontHeading.fontWeight};
          line-height: ${fontHeading.lineHeight};
          color: ${textAccent};
        }
        
        .clear-btn {
          padding: ${spacing.sm} ${spacing.md};
          background: ${dangerBg};
          color: ${textPrimary};
          border: none;
          border-radius: ${borderRadius};
          cursor: pointer;
          font-family: ${fontBody.fontFamily};
          font-size: ${fontSmall.fontSize};
          font-weight: ${fontBody.fontWeight};
          transition: all 0.2s ease;
        }
        
        .clear-btn:hover {
          filter: brightness(0.8);
          box-shadow: ${this.getShadowString(t.shadow['glow-accent-faint'])};
        }
        
        .log-container {
          flex: 1;
          background: ${interactiveActive};
          border: 1px solid ${borderColor};
          border-radius: ${borderRadius};
          padding: ${spacing.md};
          overflow-y: auto;
          font-family: 'Courier New', monospace;
          font-size: ${fontSmall.fontSize};
        }
        
        .log-entry {
          margin-bottom: ${spacing.sm};
          line-height: 1.4;
          word-wrap: break-word;
        }
        
        .timestamp {
          color: ${textSecondary};
          margin-right: ${spacing.sm};
        }
        
        .empty-message {
          color: ${textSecondary};
          font-style: italic;
          text-align: center;
          padding: ${spacing.xl};
        }
      </style>
      
      <div class="container">
        <div class="header">
          <h2>Console</h2>
          <button class="clear-btn">Clear</button>
        </div>
        <div class="log-container">
          ${this.logs.length === 0 ? 
            '<div class="empty-message">No log messages yet</div>' :
            this.logs.map(log => `
              <div class="log-entry">
                <span class="timestamp">[${log.timestamp}]</span>
                <span style="color: ${this.getLogColor(log.level, t)}">${this.escapeHtml(log.message)}</span>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;
    
    // Event listeners
    const clearBtn = this.shadowRoot.querySelector('.clear-btn');
    clearBtn?.addEventListener('click', () => this.clear());
  }
  
  /**
   * Get color for log level
   * @param {string} level - Log level
   * @param {Object} tokens - Design tokens
   * @returns {string} Color value
   */
  getLogColor(level, tokens) {
    switch(level) {
      case 'warn': return tokens.color.global['yellow-500'];
      case 'error': return tokens['color-semantic'].text.danger;
      default: return tokens['color-semantic'].text.primary;
    }
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Append a log message
   * @param {string} message - Log message
   * @param {string} level - Log level (info, warn, error)
   */
  appendLog(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({ timestamp, message, level });
    this.render();
    
    // Auto-scroll
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.log-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
  
  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.render();
  }
}

customElements.define('gamectl-console-view', GameCtlConsoleView);
export default GameCtlConsoleView;
