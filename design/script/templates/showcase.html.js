/**
 * HTML Template for Design System Showcase
 * Sci-fi display style for GameCTL IDE
 * Fully dynamic - adapts to any tokens and components
 */
export function generateShowcaseHTML(tokens) {
  const analysis = analyzeTokens(tokens);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameCTL Design System</title>
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/atomic.css">
  <link rel="stylesheet" href="css/components.css">
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
${generateInlineStyles()}
  </style>
</head>
<body>
  <header class="showcase-header">
    <div class="header-title">GAMECTL DESIGN SYSTEM</div>
    <div class="header-subtitle">SCI-FI INTERFACE FRAMEWORK</div>
  </header>

  <div class="showcase-layout">
    <aside class="showcase-sidebar">
      ${generateNavigation(analysis)}
    </aside>

    <main class="showcase-content">
      ${generateOverview(analysis)}
      ${generateTokensSection(analysis)}
      ${generateComponentsSection(analysis)}
    </main>
  </div>

  <script>
${generateInlineScript()}
  </script>
</body>
</html>`;
}

/**
 * Analyze tokens to determine structure
 */
function analyzeTokens(tokens) {
  const analysis = {
    tokenGroups: {},
    components: new Set(),
    totalCount: tokens.length
  };

  tokens.forEach(token => {
    const category = token.path[0];
    
    // Check if it's a component
    if (!['color', 'spacing', 'border', 'shadow', 'font', 'asset'].includes(category) && 
        !category.includes('semantic')) {
      analysis.components.add(category);
      return;
    }
    
    // Group tokens by category
    if (!analysis.tokenGroups[category]) {
      analysis.tokenGroups[category] = [];
    }
    analysis.tokenGroups[category].push(token);
  });

  return analysis;
}

function generateInlineStyles() {
  return `    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      background: var(--color-semantic-background-default);
      color: var(--color-semantic-text-primary);
      font-family: 'Roboto Mono', monospace;
      display: flex;
      flex-direction: column;
    }

    .showcase-header {
      background: var(--color-semantic-background-panel-header);
      border-bottom: var(--border-width-default) solid var(--color-semantic-border-accent);
      padding: var(--spacing-scale-4) var(--spacing-scale-5);
      flex-shrink: 0;
      box-shadow: var(--shadow-glow-accent-faint);
    }

    .header-title {
      font-family: 'Orbitron', sans-serif;
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-semantic-text-accent);
      text-shadow: var(--shadow-glow-accent-faint);
      letter-spacing: 2px;
    }

    .header-subtitle {
      font-size: var(--font-size-xs);
      color: var(--color-semantic-text-secondary);
      letter-spacing: 1px;
      margin-top: var(--spacing-scale-1);
    }

    .showcase-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .showcase-sidebar {
      width: 280px;
      background: var(--color-semantic-background-panel-default);
      border-right: var(--border-width-default) solid var(--color-semantic-border-default);
      overflow-y: auto;
      flex-shrink: 0;
    }

    .nav-section {
      border-bottom: var(--border-width-default) solid var(--color-semantic-border-default);
    }

    .nav-category {
      padding: var(--spacing-scale-3) var(--spacing-scale-4);
      background: var(--color-semantic-background-panel-header);
      font-weight: 700;
      color: var(--color-semantic-text-accent);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      transition: background 0.2s ease;
      font-size: var(--font-size-sm);
      letter-spacing: 0.5px;
    }

    .nav-category:hover {
      background: var(--color-semantic-background-accent-default);
    }

    .nav-category .icon {
      font-size: var(--font-size-xs);
      transition: transform 0.2s ease;
    }

    .nav-category.collapsed .icon {
      transform: rotate(-90deg);
    }

    .nav-items {
      background: var(--file-tree-background);
    }

    .nav-items.hidden {
      display: none;
    }

    .nav-item {
      padding: var(--spacing-scale-2) var(--spacing-scale-4);
      padding-left: var(--spacing-scale-5);
      color: var(--file-tree-item-text-default);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
      font-size: var(--font-size-sm);
    }

    .nav-item:hover {
      background: var(--file-tree-item-background-hover);
      color: var(--file-tree-item-text-hover);
    }

    .nav-item.active {
      background: var(--file-tree-item-background-selected);
      color: var(--file-tree-item-text-hover);
      border-left-color: var(--color-semantic-border-accent);
    }

    .showcase-content {
      flex: 1;
      padding: var(--spacing-scale-6);
      overflow-y: auto;
      scroll-behavior: smooth;
    }

    .section {
      margin-bottom: var(--spacing-scale-8);
      scroll-margin-top: var(--spacing-scale-4);
    }

    .section-title {
      font-family: 'Orbitron', sans-serif;
      font-size: var(--font-size-lg);
      color: var(--color-semantic-text-accent);
      margin-bottom: var(--spacing-scale-5);
      padding-bottom: var(--spacing-scale-2);
      border-bottom: var(--border-width-default) solid var(--color-semantic-border-accent);
      text-shadow: var(--shadow-glow-accent-faint);
      letter-spacing: 1px;
    }

    .subsection-title {
      font-family: 'Orbitron', sans-serif;
      font-size: var(--font-size-md);
      color: var(--color-semantic-text-primary);
      margin: var(--spacing-scale-5) 0 var(--spacing-scale-3);
      text-transform: uppercase;
    }

    .description {
      color: var(--color-semantic-text-secondary);
      line-height: 1.6;
      margin-bottom: var(--spacing-scale-4);
    }

    .token-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--spacing-scale-3);
      margin-bottom: var(--spacing-scale-5);
    }

    .token-card {
      background: var(--color-semantic-background-panel-default);
      border: var(--border-width-default) solid var(--color-semantic-border-default);
      border-radius: var(--border-radius-sm);
      padding: var(--spacing-scale-3);
      transition: border-color 0.2s ease;
    }

    .token-card:hover {
      border-color: var(--color-semantic-border-accent);
    }

    .token-name {
      font-size: var(--font-size-xs);
      color: var(--color-semantic-text-accent);
      margin-bottom: var(--spacing-scale-2);
      word-break: break-all;
    }

    .token-value {
      font-size: var(--font-size-xs);
      color: var(--color-semantic-text-secondary);
    }

    .color-swatch {
      width: 100%;
      height: 60px;
      border: var(--border-width-default) solid var(--color-semantic-border-default);
      border-radius: var(--border-radius-sm);
      margin-bottom: var(--spacing-scale-2);
    }

    .example-container {
      background: var(--color-semantic-background-panel-default);
      border: var(--border-width-default) solid var(--color-semantic-border-default);
      border-radius: var(--border-radius-sm);
      padding: var(--spacing-scale-5);
      margin-bottom: var(--spacing-scale-4);
    }

    .example-label {
      font-size: var(--font-size-xs);
      color: var(--color-semantic-text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: var(--spacing-scale-3);
    }

    .example-row {
      display: flex;
      gap: var(--spacing-scale-3);
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .code-block {
      background: var(--color-global-grey-900);
      border: var(--border-width-default) solid var(--color-semantic-border-default);
      border-radius: var(--border-radius-sm);
      padding: var(--spacing-scale-4);
      margin: var(--spacing-scale-3) 0;
      overflow-x: auto;
      font-size: var(--font-size-xs);
      color: var(--color-global-cyan-300);
    }

    @media (max-width: 768px) {
      .showcase-sidebar {
        position: fixed;
        left: -280px;
        height: 100%;
        z-index: 1000;
        transition: left 0.3s ease;
      }

      .showcase-sidebar.open {
        left: 0;
      }

      .showcase-content {
        padding: var(--spacing-scale-4);
      }
    }`;
}

function generateNavigation(analysis) {
  const tokenCategories = Object.keys(analysis.tokenGroups).sort();
  const components = Array.from(analysis.components).sort();

  return `      <div class="nav-section">
        <div class="nav-category">
          <span class="icon">▼</span>
          <span>OVERVIEW</span>
        </div>
        <div class="nav-items">
          <a href="#overview" class="nav-item active">Introduction</a>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-category" onclick="toggleCategory(this)">
          <span class="icon">▼</span>
          <span>TOKENS</span>
        </div>
        <div class="nav-items">
${tokenCategories.map(cat => `          <a href="#${cat}" class="nav-item">${formatLabel(cat)}</a>`).join('\n')}
        </div>
      </div>

${components.length > 0 ? `      <div class="nav-section">
        <div class="nav-category" onclick="toggleCategory(this)">
          <span class="icon">▼</span>
          <span>COMPONENTS</span>
        </div>
        <div class="nav-items">
${components.map(comp => `          <a href="#${comp}" class="nav-item">${formatLabel(comp)}</a>`).join('\n')}
        </div>
      </div>` : ''}`;
}

function generateOverview(analysis) {
  const stats = {
    tokens: analysis.totalCount,
    categories: Object.keys(analysis.tokenGroups).length,
    components: analysis.components.size
  };

  return `      <section id="overview" class="section">
        <h1 class="section-title">OVERVIEW</h1>
        <p class="description">
          GameCTL IDE design system - a sci-fi inspired interface framework.
          All components and utilities are generated from DTCG-compliant design tokens.
        </p>
        <div class="example-container">
          <div class="token-grid">
            <div class="token-card">
              <div class="token-name">${stats.tokens}</div>
              <div class="token-value">Total Tokens</div>
            </div>
            <div class="token-card">
              <div class="token-name">${stats.categories}</div>
              <div class="token-value">Token Categories</div>
            </div>
            <div class="token-card">
              <div class="token-name">${stats.components}</div>
              <div class="token-value">Components</div>
            </div>
          </div>
        </div>
      </section>`;
}

function generateTokensSection(analysis) {
  const sections = Object.entries(analysis.tokenGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, tokens]) => {
      return `        <div id="${category}" class="section">
          <h2 class="subsection-title">${formatLabel(category)}</h2>
          <div class="token-grid">
${tokens.map(token => generateTokenCard(token, category)).join('\n')}
          </div>
        </div>`;
    }).join('\n\n');

  return `      <section id="tokens" class="section">
        <h1 class="section-title">DESIGN TOKENS</h1>
        
${sections}
      </section>`;
}

function generateTokenCard(token, category) {
  // Color tokens with swatch
  if (token.$type === 'color') {
    return `            <div class="token-card">
              <div class="color-swatch" style="background: var(--${token.name});"></div>
              <div class="token-name">${token.name}</div>
              <div class="token-value">${token.$value}</div>
            </div>`;
  }
  
  // Spacing/dimension tokens with visual bar
  if (token.$type === 'dimension' && category === 'spacing') {
    return `            <div class="token-card">
              <div style="background: var(--color-semantic-border-accent); height: 4px; width: var(--${token.name}); margin-bottom: var(--spacing-scale-2);"></div>
              <div class="token-name">${token.name}</div>
              <div class="token-value">${token.$value}</div>
            </div>`;
  }
  
  // Default token card
  return `            <div class="token-card">
              <div class="token-name">${token.name}</div>
              <div class="token-value">${token.$value}</div>
            </div>`;
}

function generateComponentsSection(analysis) {
  const components = Array.from(analysis.components).sort();
  
  if (components.length === 0) {
    return '';
  }

  const sections = components.map(comp => generateComponentExample(comp)).join('\n\n');

  return `      <section id="components" class="section">
        <h1 class="section-title">COMPONENTS</h1>
        
${sections}
      </section>`;
}

function generateComponentExample(componentName) {
  // Auto-detect variants by checking CSS classes
  const examples = {
    button: generateButtonExample(),
    panel: generatePanelExample(),
    select: generateSelectExample(),
    list: generateListExample(),
    'file-tree': generateFileTreeExample()
  };

  return examples[componentName] || generateGenericComponentExample(componentName);
}

function generateButtonExample() {
  return `        <div id="button" class="section">
          <h2 class="subsection-title">Button</h2>
          <div class="example-container">
            <div class="example-label">Variants</div>
            <div class="example-row">
              <button class="button-primary">Primary</button>
              <button class="button-secondary">Secondary</button>
              <button class="button-danger">Danger</button>
            </div>
          </div>
          <div class="code-block">&lt;button class="button-primary"&gt;Primary&lt;/button&gt;</div>
        </div>`;
}

function generatePanelExample() {
  return `        <div id="panel" class="section">
          <h2 class="subsection-title">Panel</h2>
          <div class="example-container">
            <div class="panel">
              <div class="panel-header">Panel Header</div>
              <div class="panel-content">
                Panel content area with example text to demonstrate the styling.
              </div>
            </div>
          </div>
          <div class="code-block">&lt;div class="panel"&gt;
  &lt;div class="panel-header"&gt;Header&lt;/div&gt;
  &lt;div class="panel-content"&gt;Content&lt;/div&gt;
&lt;/div&gt;</div>
        </div>`;
}

function generateSelectExample() {
  return `        <div id="select" class="section">
          <h2 class="subsection-title">Select</h2>
          <div class="example-container">
            <select class="select">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
          </div>
          <div class="code-block">&lt;select class="select"&gt;...&lt;/select&gt;</div>
        </div>`;
}

function generateListExample() {
  return `        <div id="list" class="section">
          <h2 class="subsection-title">List</h2>
          <div class="example-container">
            <div class="list">
              <div class="list-item">List Item 1</div>
              <div class="list-item">List Item 2</div>
              <div class="list-item">List Item 3</div>
            </div>
          </div>
          <div class="code-block">&lt;div class="list"&gt;
  &lt;div class="list-item"&gt;Item&lt;/div&gt;
&lt;/div&gt;</div>
        </div>`;
}

function generateFileTreeExample() {
  return `        <div id="file-tree" class="section">
          <h2 class="subsection-title">File Tree</h2>
          <div class="example-container">
            <div class="file-tree">
              <div class="file-tree-item">📁 src/</div>
              <div class="file-tree-item" style="padding-left: var(--spacing-scale-5);">📄 index.js</div>
              <div class="file-tree-item" style="padding-left: var(--spacing-scale-5);">📄 app.js</div>
              <div class="file-tree-item">📁 build/</div>
            </div>
          </div>
          <div class="code-block">&lt;div class="file-tree"&gt;
  &lt;div class="file-tree-item"&gt;Item&lt;/div&gt;
&lt;/div&gt;</div>
        </div>`;
}

function generateGenericComponentExample(componentName) {
  return `        <div id="${componentName}" class="section">
          <h2 class="subsection-title">${formatLabel(componentName)}</h2>
          <div class="example-container">
            <div class="${componentName}">
              ${formatLabel(componentName)} component example
            </div>
          </div>
          <div class="code-block">&lt;div class="${componentName}"&gt;...&lt;/div&gt;</div>
        </div>`;
}

function formatLabel(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateInlineScript() {
  return `    function toggleCategory(element) {
      element.classList.toggle('collapsed');
      const items = element.nextElementSibling;
      items.classList.toggle('hidden');
    }

    const sections = document.querySelectorAll('.section[id]');
    const navItems = document.querySelectorAll('.nav-item');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + entry.target.id) {
              item.classList.add('active');
            }
          });
        }
      });
    }, { threshold: 0.5 });

    sections.forEach(section => observer.observe(section));

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = item.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });`;
}
