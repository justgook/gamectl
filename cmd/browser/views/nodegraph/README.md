# Node Graph System

A visual node-based pipeline editor for creating procedural generation workflows.

## Architecture

### Components

- **`node-base.js`** - Base class for all node types with common functionality
- **`node-input.js`** - User input nodes (numbers, text, ranges)
- **`node-plugin.js`** - Plugin execution nodes (calls WASM plugins)
- **`node-output.js`** - Terminal output nodes (display results)
- **`view-nodegraph.js`** - Main canvas view that renders and manages nodes

### Connection Model

Nodes use **Input ← Output** (reverse reference) connection model:
- Target nodes declare their input sources via attributes: `input-{portName}="sourceNodeId"`
- This makes dependency resolution straightforward
- Example: `<node-plugin input-nodeCount="n1" input-maxDepth="n2">`

### Node Lifecycle

1. Node is created as HTML element
2. `connectedCallback()` registers with parent `ViewNodeGraph`
3. Attributes control position, state, and connections
4. `attributeChangedCallback()` triggers redraw when attributes change
5. `execute()` method runs node logic and produces outputs

## Usage

### Creating a Simple Pipeline

```html
<view-nodegraph>
  <!-- Input nodes -->
  <node-input id="count" 
              x="100" y="100" 
              type="number" 
              value="10" 
              label="Node Count">
  </node-input>
  
  <node-input id="depth" 
              x="100" y="200" 
              type="number" 
              value="5" 
              label="Max Depth">
  </node-input>
  
  <!-- Plugin node - declares its inputs -->
  <node-plugin id="treegen" 
               x="400" y="150"
               plugin="treegen" 
               function="gen"
               inputs="nodeCount,maxDepth,maxBranching,rootBranches"
               outputs="tree"
               input-nodeCount="count"
               input-maxDepth="depth">
  </node-plugin>
  
  <!-- Output node -->
  <node-output id="result" 
               x="700" y="150"
               label="Tree Result"
               format="json"
               input-value="treegen">
  </node-output>
</view-nodegraph>
```

### Node Types

#### Input Node
Provides user-configurable values.

```html
<node-input id="myInput" 
            x="100" y="100"
            type="number|text|range"
            value="10"
            label="Display Name"
            min="0" max="100" step="1">
</node-input>
```

**Attributes:**
- `type`: Input type (number, text, range)
- `value`: Current value
- `label`: Display label
- `min`, `max`, `step`: For numeric inputs

**Outputs:**
- `output`: The current value

#### Plugin Node
Executes a WASM plugin function.

```html
<node-plugin id="myPlugin" 
             x="400" y="100"
             plugin="pluginName"
             function="functionName"
             inputs="port1,port2,port3"
             outputs="output"
             input-port1="sourceNode1"
             input-port2="sourceNode2.outputPort">
</node-plugin>
```

**Attributes:**
- `plugin`: Plugin module name
- `function`: Function to call
- `inputs`: Comma-separated input port names
- `outputs`: Comma-separated output port names
- `input-{portName}`: Connection to source node (format: `nodeId` or `nodeId.portName`)

**Behavior:**
- Collects inputs from connected nodes
- Calls `pluginManager.call(plugin, function, inputs)`
- Stores result in `outputValue`

#### Output Node
Terminal node that displays/logs results.

```html
<node-output id="result" 
             x="700" y="100"
             label="Result"
             format="json|text|number"
             input-value="sourceNode">
</node-output>
```

**Attributes:**
- `label`: Display label
- `format`: Output format (json, text, number)
- `input-value`: Connection to source node

**Behavior:**
- Formats input value according to `format` attribute
- Logs to console (future: display in UI)

### Node States

Nodes have visual states represented by colors:

- **idle** (gray) - Waiting for inputs or not yet executed
- **ready** (blue) - Has all inputs, ready to execute
- **running** (yellow) - Currently executing
- **success** (green) - Completed successfully
- **error** (red) - Failed with error

### Interactions

#### Pan & Zoom
- **Mouse wheel**: Pan (or Ctrl/Cmd + wheel to zoom)
- **Click + drag** on empty space: Pan viewport
- **Zoom buttons**: +/− buttons in toolbar
- **Fit to content**: ⊡ button

#### Node Selection & Movement
- **Click node**: Select (Ctrl/Cmd+click for multi-select)
- **Drag node**: Move node position

#### Creating Connections
1. Click and drag from an **output port** (right side of node)
2. Drag to an **input port** (left side of target node)
3. Release to create connection

#### Execution
- Click **▶ Run** button to execute the pipeline
- Nodes execute in topological order based on dependencies

## Programmatic API

### Adding Nodes

```javascript
const graph = document.querySelector('view-nodegraph')

// Create input node
const input = document.createElement('node-input')
input.id = 'myInput'
input.setAttribute('x', '100')
input.setAttribute('y', '100')
input.setAttribute('value', '42')
input.setAttribute('label', 'My Value')
graph.appendChild(input)

// Create plugin node
const plugin = document.createElement('node-plugin')
plugin.id = 'myPlugin'
plugin.setAttribute('x', '400')
plugin.setAttribute('y', '100')
plugin.setAttribute('plugin', 'treegen')
plugin.setAttribute('function', 'gen')
plugin.setAttribute('input-nodeCount', 'myInput')
graph.appendChild(plugin)
```

### Connecting Nodes

```javascript
// Connect sourceNode's output to targetNode's inputPort
graph.connectNodes('sourceNode', 'output', 'targetNode', 'inputPort')

// Or directly via attributes
targetNode.setAttribute('input-portName', 'sourceNode')
```

### Executing Graph

```javascript
// Execute entire graph
await graph.executeGraph()

// Or execute individual node
await node.execute()
```

### Accessing Node Data

```javascript
const node = graph.nodes.get('nodeId')
console.log('State:', node.state)
console.log('Output:', node.outputValue)
console.log('Inputs:', node.getInputConnections())
```

## TODO / Future Enhancements

### Core Features
- [ ] Implement topological sort for graph execution
- [ ] Add execution queue and progress tracking
- [ ] Implement cycle detection
- [ ] Add pause/resume/stop execution controls

### UI Features
- [ ] Add node creation menu (+ Node button)
- [ ] Add context menu (right-click on node)
- [ ] Add connection deletion (right-click connection)
- [ ] Add node deletion (delete key)
- [ ] Add multi-node selection box (drag on empty space)
- [ ] Add copy/paste nodes (Ctrl+C/V)
- [ ] Add undo/redo (Ctrl+Z/Y)

### Node Types
- [ ] Add transform nodes (JSON parse, math operations, etc)
- [ ] Add control flow nodes (if/else, loop, switch)
- [ ] Add merge nodes (combine multiple inputs)
- [ ] Add split nodes (split outputs to multiple paths)

### Visualization
- [ ] Add minimap for large graphs
- [ ] Add connection curve styling options
- [ ] Add node grouping/comments
- [ ] Add execution animation (flow visualization)

### Data Management
- [ ] Save/load graph to JSON/XML
- [ ] Export graph as image
- [ ] Import from existing pipeline definitions
- [ ] Version control integration

### Developer Tools
- [ ] Add node inspector panel
- [ ] Add execution log/timeline
- [ ] Add breakpoints on nodes
- [ ] Add performance profiling

## Example: Tree Generation Pipeline

```html
<view-nodegraph>
  <!-- Inputs -->
  <node-input id="count" x="100" y="100" type="number" value="10" label="Node Count"></node-input>
  <node-input id="depth" x="100" y="180" type="number" value="0" label="Max Depth"></node-input>
  <node-input id="branch" x="100" y="260" type="number" value="0" label="Max Branching"></node-input>
  <node-input id="root" x="100" y="340" type="number" value="0" label="Root Branches"></node-input>
  
  <!-- Tree Generator -->
  <node-plugin id="treegen" 
               x="400" y="200"
               plugin="treegen" 
               function="gen"
               inputs="nodeCount,maxDepth,maxBranching,rootBranches"
               input-nodeCount="count"
               input-maxDepth="depth"
               input-maxBranching="branch"
               input-rootBranches="root">
  </node-plugin>
  
  <!-- Minimap Generator -->
  <node-plugin id="minimap" 
               x="700" y="200"
               plugin="minimap" 
               function="gen"
               inputs="treeId"
               input-treeId="treegen">
  </node-plugin>
  
  <!-- Output -->
  <node-output id="result" 
               x="1000" y="200"
               label="Final Map"
               input-value="minimap">
  </node-output>
</view-nodegraph>
```

## File Structure

```
cmd/browser/views/
├── view-nodegraph.js           # Main view (canvas rendering, interaction)
└── nodegraph/
    ├── README.md               # This file
    ├── node-base.js            # Base node class
    ├── node-input.js           # Input nodes
    ├── node-plugin.js          # Plugin nodes
    └── node-output.js          # Output nodes
```
