-- Node Templates Database
-- Pure HTML templates for node creation (no id/x/y - handled by nodegraph)
-- NOTE: node-popup content MUST be wrapped in <template> to prevent premature rendering

CREATE TABLE IF NOT EXISTS node_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  html_template TEXT NOT NULL
);

-- Clear existing templates (for development - allows re-running migration)
DELETE FROM node_templates;

-- Input Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Number Input',
  'input',
  'User input for numeric values',
  '<node-input type="number" value="10" label="Value"></node-input>'
),
(
  'Text Input',
  'input',
  'User input for text',
  '<node-input type="text" value="" label="Text"></node-input>'
),
(
  'Range Input',
  'input',
  'Slider input',
  '<node-input type="range" value="50" min="0" max="100" label="Slider"></node-input>'
);

-- Plugin Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Tree Generator',
  'plugin',
  'Generate procedural tree',
  '<node-plugin title="Tree Generator" x="135" y="160" plugin="treegen" function="gen" inputs="name,nodeCount,maxDepth,maxBranching,rootBranches" outputs="result"></node-plugin>'
),
(
  'AutoMap',
  'plugin',
  'Generate tiles from rules',
  '<node-plugin title="AutoMap" x="135" y="160" plugin="automap" function="automap" inputs="rulesMapId,inputMapId,outputMapId" outputs="result"></node-plugin>'
),
(
  'Minimap Generator',
  'plugin',
  'Generate minimap from tree',
  '<node-plugin title="Minimap Generator" plugin="minimap" function="gen" inputs="treeId,mapId" outputs="result"></node-plugin>'
),
(
  'Tilemap Scaler',
  'plugin',
  'Scale tilemap by integer factor',
  '<node-plugin title="Tilemap Scaler" plugin="scaler" function="scale" inputs="inputMapId,outputMapId,scaleFactor" outputs="result"></node-plugin>'
),
(
  'Logger',
  'plugin',
  'Log output to console',
  '<node-plugin plugin="host" function="log" inputs="logInput"></node-plugin>'
);

-- Utility Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Extract Fields',
  'util',
  'Extract fields from object',
  '<node-fields inputs="input" outputs="output,returnCode"></node-fields>'
),
(
  'To String',
  'util',
  'Convert to string',
  '<node-tostring inputs="input"></node-tostring>'
);

-- Interactive Template Nodes (content wrapped in <template>)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Text Input',
  'template',
  'Simple text input field',
  '<node-popup title="Text" label="THE TEXT" outputs="text"><template><div style="padding:16px"><input type="text" data-output="text" value="" placeholder="Enter text..." style="font-size:16px;padding:8px;border:2px solid #ddd;border-radius:4px;width:100%"></div></template></node-popup>'
),
(
  'Input Processor',
  'template', 
  'Example showing input and output data attributes',
  '<node-popup inputs="baseValue" outputs="result"><template><div style="padding:16px"><label>From connected node:</label><input type="number" data-input="baseValue" readonly style="background:#f5f5f5;padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;margin-bottom:8px"><label>Manual value:</label><input type="number" data-output="result" value="10" style="padding:8px;border:2px solid #ddd;border-radius:4px;width:100%;margin-bottom:8px"><button type="button" onclick="let b=document.querySelector(''[data-input=baseValue]'');let r=document.querySelector(''[data-output=result]'');if(b.value)r.value=b.value" style="padding:8px;background:#007bff;color:white;border:none;border-radius:4px">Copy Base Value</button></div></template></node-popup>'
),
(
  'Simple Numpad Test',
  'template',
  'Simple numpad test template',
  '<node-popup outputs="value"><template><input data-output="value" value="0"><button onclick="this.parentNode.querySelector(''input'').value+=''1''">1</button><button onclick="this.parentNode.querySelector(''input'').value+=''2''">2</button><button onclick="this.parentNode.querySelector(''input'').value=''''">C</button></template></node-popup>'
),
(
  'Number Input with Numpad',
  'template',
  'Interactive number input with numpad interface',
  '<node-popup outputs="value"><template><div style="padding:12px" data-numpad><input type="number" data-output="value" value="0" style="font-size:16px;padding:8px;width:100%;text-align:center;margin-bottom:10px"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px"><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `7`; i.focus()" style="padding:8px;font-size:14px">7</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `8`; i.focus()" style="padding:8px;font-size:14px">8</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `9`; i.focus()" style="padding:8px;font-size:14px">9</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `4`; i.focus()" style="padding:8px;font-size:14px">4</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `5`; i.focus()" style="padding:8px;font-size:14px">5</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `6`; i.focus()" style="padding:8px;font-size:14px">6</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `1`; i.focus()" style="padding:8px;font-size:14px">1</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `2`; i.focus()" style="padding:8px;font-size:14px">2</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `3`; i.focus()" style="padding:8px;font-size:14px">3</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value = String(i.value||``) + `0`; i.focus()" style="padding:8px;font-size:14px">0</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value=i.value.slice(0,-1); i.focus()" style="padding:8px;font-size:14px;background:#ff6b6b;color:white">⌫</button><button onclick="let i=this.closest(`[data-numpad]`).querySelector(`input`); i.value=``; i.focus()" style="padding:8px;font-size:14px;background:#ff6b6b;color:white">Clear</button></div></div></template></node-popup>'
);

-- Preview Nodes (content wrapped in <template>)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Tree Preview',
  'preview',
  'Preview tree structure from input (uses data-input-target)',
  '<node-popup inputs="storeKey" outputs="storeKey" data-input-target="storeKey:view-tree@data-store-key"><template><view-tree data-store-key="progression" style="width:800px;height:600px;border:1px solid #ccc;border-radius:4px"></view-tree></template></node-popup>'
),
(
  'Tilemap Preview',
  'preview',
  'Preview tilemap from input (uses data-input-target)',
  '<node-popup inputs="mapId" outputs="mapId" data-input-target="mapId:view-tilemap@data-key"><template><view-tilemap data-key="new_map" style="width:800px;height:600px;border:1px solid #ccc;border-radius:4px"></view-tilemap></template></node-popup>'
),
(
  'Tree Preview (onopen)',
  'preview',
  'Preview tree with custom onopen handler',
  '<node-popup inputs="storeKey" outputs="storeKey" onopen="const tree = content.querySelector(''view-tree''); if (inputs.storeKey) tree.setAttribute(''data-store-key'', inputs.storeKey);"><template><view-tree data-store-key="progression" style="width:800px;height:600px;border:1px solid #ccc;border-radius:4px"></view-tree></template></node-popup>'
);
