/**
 * GameCtl Test Controls View Component
 * Test workflow controls with buttons to run plugin chains
 */

import GameCtlBaseView from './base-view.js';

class GameCtlTestControlsView extends GameCtlBaseView {
  constructor() {
    super();
  }

  render() {
    const t = this.getTokens();
    if (!t) return;

    const bgPanel = t['color-semantic'].background.panel;
    const textAccent = t['color-semantic'].text.accent;
    const textPrimary = t['color-semantic'].text.primary;
    const spacing = {
      sm: t.spacing['scale-2'],
      md: t.spacing['scale-3'],
      lg: t.spacing['scale-4'],
      xl: t.spacing['scale-5']
    };
    const fontHeading = t['font-semantic'].heading.default;
    const fontBody = t['font-semantic'].body.default;
    const borderRadius = t.border.radius.sm;
    const accentBg = t['color-semantic'].background['accent-default'];
    const accentHover = t['color-semantic'].background['accent-hover'];
    const glowAccent = t.shadow['glow-accent-faint'];

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
        
        h2 {
          margin: 0 0 ${spacing.lg} 0;
          font-family: ${fontHeading.fontFamily};
          font-size: ${fontHeading.fontSize};
          font-weight: ${fontHeading.fontWeight};
          line-height: ${fontHeading.lineHeight};
          color: ${textAccent};
        }
        
        .test-button {
          display: block;
          width: 100%;
          margin-bottom: ${spacing.md};
          padding: ${spacing.md};
          background: ${accentBg};
          color: ${textPrimary};
          border: none;
          border-radius: ${borderRadius};
          cursor: pointer;
          font-family: ${fontBody.fontFamily};
          font-size: ${fontBody.fontSize};
          font-weight: ${fontBody.fontWeight};
          transition: all 0.2s ease;
        }
        
        .test-button:hover:not(:disabled) {
          background: ${accentHover};
          box-shadow: ${this.getShadowString(glowAccent)};
        }
        
        .test-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        
        .test-button.success {
          background: #28a745;
        }
        
        .test-button.error {
          background: ${t['color-semantic'].background.danger};
        }
      </style>
      
      <div class="container">
        <h2>Test Workflow Controls</h2>
        
        <button class="test-button" data-action="generateWorldgraph">
          Phase 1: Generate Worldgraph
        </button>
        
        <button class="test-button" data-action="testTreeStorage">
          Phase 1.5: Test Tree Storage
        </button>
        
        <button class="test-button" data-action="generateMinimap">
          Phase 2: Generate Minimap
        </button>
        
        <button class="test-button" data-action="testTilemapStorage">
          Phase 3: Test Tilemap Storage
        </button>
        
        <button class="test-button" data-action="testAutomap">
          Phase 4: Test Automap
        </button>
        
        <button class="test-button success" data-action="runFullPipeline">
          Run All Phases
        </button>
      </div>
    `;

    // Event listeners
    this.shadowRoot.querySelectorAll('.test-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        await this.handleButtonClick(btn, action);
      });
    });
  }

  async handleButtonClick(btn, action) {
    const originalText = btn.textContent.trim();
    btn.disabled = true;
    btn.textContent = `${originalText}...`;

    try {
      await this[action]();
      btn.classList.add('success');
      btn.textContent = `${originalText} ✓`;
      setTimeout(() => {
        btn.classList.remove('success');
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    } catch (error) {
      btn.classList.add('error');
      btn.textContent = `${originalText} ✗`;
      console.error(`Failed to ${action}:`, error);
      setTimeout(() => {
        btn.classList.remove('error');
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  /**
   * Phase 1: Generate worldgraph from plugins
   */
  async generateWorldgraph() {
    this._log('=== Phase 1: Worldgraph Generation ===');

    const biomes = {
      biomes: ["Start", "Caves", "Ruins", "Tower", "Lab", "Depths"],
      keys: ["DoubleJump", "KeyA", "KeyB", "Fireball"],
      treeId: "demo-world",
      storeTree: true
    };

    const input = JSON.stringify(biomes);
    const result = await this.pluginManager.call('worldgraph', 'worldgraph2', input);

    const tree = new TextDecoder().decode(result.output);

    this._log(`Worldgraph generated and stored as "demo-world"`);
    this._log(`Output (first 200 chars): ${tree.substring(0, 200)}...`);
    return tree;
  }

  /**
   * Phase 2: Generate minimap from worldgraph (using tree-storage)
   */
  async generateMinimap() {
    this._log('=== Phase 2: Minimap Generation (from tree-storage) ===');

    const minimapInput = {
      treeId: "demo-world"
    };

    const input = JSON.stringify(minimapInput);
    const result = await this.pluginManager.call('minimap', 'minimap', input);

    const output = new TextDecoder().decode(result.output);
    this._log('Generated Minimap JSON:');
    this._log('minimap: ' + output.substring(0, 200) + '...');

    // Save the minimap result to tilemap storage
    this._log('Saving minimap to tilemap storage...');
    const tilemapData = JSON.parse(output);
    const saveInput = {
      id: 'minimap',
      map: tilemapData
    };

    const saveResult = await this.pluginManager.call('tilemap-storage', 'set', JSON.stringify(saveInput));
    if (saveResult.returnCode === 0) {
      this._log('✅ Minimap saved to tilemap storage');

      // Refresh any open tilemap inspectors
      if (this.ide) {
        this.ide.refreshTilemapInspectors();
      }
    } else {
      this._log('❌ Failed to save minimap to tilemap storage');
    }

    this._log('Tilemap ready for inspection');
  }

  /**
   * Phase 1.5: Test Tree Storage
   */
  async testTreeStorage() {
    this._log('=== Phase 1.5: Tree Storage Test ===');

    let result = await this.pluginManager.call('tree-storage', 'list', JSON.stringify({}));
    this._log(`List: ${new TextDecoder().decode(result.output)}`);

    const getInput = { id: 'demo-world' };
    result = await this.pluginManager.call('tree-storage', 'get', JSON.stringify(getInput));
    this._log(`Get: ${result.output.length} bytes`);

    this._log('All tree storage tests completed!');
  }

  /**
   * Phase 3: Test Tilemap Storage
   */
  async testTilemapStorage() {
    this._log('=== Phase 3: Tilemap Storage Test ===');

    const createInput = {
      id: 'test-map',
      map: {
        layers: [],
        meta: {
          tileWidth: '32',
          tileHeight: '32',
          name: 'Test Map'
        }
      }
    };
    let result = await this.pluginManager.call('tilemap-storage', 'set', JSON.stringify(createInput));
    this._log(`Create: ${new TextDecoder().decode(result.output)}`);

    this._log('All tilemap storage tests completed!');
  }

  /**
   * Phase 4: Test Automap
   */
  async testAutomap() {
    this._log('=== Phase 4: Automap Test ===');

    const initInput = {};
    let result = await this.pluginManager.call('automap', 'init', JSON.stringify(initInput));
    this._log(`Init: ${new TextDecoder().decode(result.output)}`);

    this._log('All automap tests completed!');
  }

  /**
   * Run full pipeline: all phases
   */
  async runFullPipeline() {
    this._log('=== Running Full Pipeline ===');
    await this.generateWorldgraph();
    await this.testTreeStorage();
    await this.generateMinimap();
    await this.testTilemapStorage();
    await this.testAutomap();
    this._log('=== Pipeline Complete ===');
  }

  /**
   * Log a message
   * @param {string} message - Message to log
   */
  _log(message) {
    console.log(`[TestControls] ${message}`);

    // Also send to plugin log system if available
    if (this.pluginManager) {
      const input = new TextEncoder().encode(message);
      this.pluginManager.call('host', 'log', input).catch(() => {
        // Ignore errors - host function might not be available
      });
    }
  }
}

customElements.define('gamectl-test-controls-view', GameCtlTestControlsView);
export default GameCtlTestControlsView;
