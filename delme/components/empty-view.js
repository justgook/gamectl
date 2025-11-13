/**
 * GameCtl Empty View Component
 * Placeholder view showing "Select a view from dropdown"
 */

import GameCtlBaseView from './base-view.js';

class GameCtlEmptyView extends GameCtlBaseView {
  constructor() {
    super();
  }
  
  render() {
    const t = this.getTokens();
    if (!t) return;
    
    const bgPanel = t['color-semantic'].background.panel;
    const textSecondary = t['color-semantic'].text.secondary;
    const fontSize = t.font.size.md;
    const fontFamily = t.font.family.ui;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          background: ${bgPanel};
        }
        
        .message {
          color: ${textSecondary};
          font-size: ${fontSize};
          font-family: ${fontFamily};
          font-style: italic;
          text-align: center;
          padding: 20px;
        }
      </style>
      
      <div class="message">
        Select a view from the dropdown above
      </div>
    `;
  }
}

customElements.define('gamectl-empty-view', GameCtlEmptyView);
export default GameCtlEmptyView;
