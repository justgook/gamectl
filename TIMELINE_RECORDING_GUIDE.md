# 🎬 Timeline Recording & Editing Guide

## 🎥 **Recording Animations**

### **Method 1: Auto-Record Mode (Current Implementation)**
```javascript
// Enable recording mode
1. Switch to Timeline view in any panel
2. Click the 🔴 Record button in the header
3. Switch to Skeleton view in another panel
4. Manipulate bones - transformations are automatically recorded
5. Click 🔴 Record again to stop recording
```

### **Method 2: Manual Keyframe Creation**
```javascript
// Add keyframes at specific times
1. Right-click on any track in the timeline
2. Select "Add Keyframe" from context menu
3. Enter keyframe values in the popup editor
4. Keyframe appears at current time position
```

### **Method 3: Skeleton Integration (Enhanced)**
```javascript
// Record bone transformations automatically
// This happens when record mode is enabled
```

## ✏️ **Editing Keyframes**

### **Basic Editing**
```javascript
// Click to select keyframes
1. Click on any keyframe (○ or ●) to select it
2. Selected keyframes are highlighted
3. Right-click for context menu options
```

### **Advanced Editing**
```javascript
// Edit keyframe properties
1. Double-click on a keyframe
2. Popup editor opens with:
   - Time position
   - Value (angle, position, etc.)
   - Easing function (linear, ease-in, ease-out, etc.)
3. Apply changes and close popup
```

### **Keyboard Shortcuts**
```javascript
// Timeline keyboard controls
Space        - Play/Pause animation
Delete       - Delete selected keyframes
Ctrl+C/V     - Copy/Paste keyframes
Left/Right   - Nudge selected keyframes
Escape       - Stop animation
```

## 🎯 **Timeline Controls**

### **Playback Controls**
- **▶ Play** - Start animation playback
- **⏸ Pause** - Pause animation at current time
- **⏹ Stop** - Stop and reset to beginning
- **🔁 Loop** - Toggle loop playback
- **Speed** - Adjust playback speed (0.25x to 4x)

### **Navigation**
- **Pan** - Drag on empty space to pan timeline
- **Zoom** - Mouse wheel to zoom in/out
- **Fit** - Fit entire timeline to view

## 🎨 **Visual Indicators**

### **Keyframe Shapes**
- **○ Circle** - Keyframe with easing (smooth transition)
- **◇ Diamond** - Linear keyframe (straight transition)
- **● Filled** - Selected keyframe
- **○ Hollow** - Unselected keyframe

### **Track Colors**
- Each track represents a different animated property
- Colors indicate different bone/property types
- Track headers show property names

## 🔄 **Workflow Example**

### **Creating a Simple Animation**
```javascript
// 1. Setup
- Switch to Timeline view
- Ensure default timeline is loaded (0.00s / 2.00s)

// 2. Record Mode
- Click 🔴 Record button
- Switch to Skeleton view

// 3. Animate
- Move to time 0.0s
- Rotate arm bone to desired angle
- Move to time 1.0s  
- Rotate arm to different angle
- Timeline automatically creates keyframes

// 4. Playback
- Return to Timeline view
- Click ▶ Play to see animation
- Adjust timing and easing as needed

// 5. Save
- Click 💾 Save to persist animation
```

### **Editing Existing Animation**
```javascript
// 1. Load Timeline
- Switch to Timeline view
- Timeline loads automatically

// 2. Select Keyframes
- Click on keyframes to select
- Use Ctrl+click for multi-select

// 3. Edit Properties
- Double-click keyframe to edit
- Change timing, values, easing
- Apply changes

// 4. Test Changes
- Play animation to preview
- Make further adjustments
- Save when satisfied
```

## 🔧 **Advanced Features**

### **Multi-Track Animation**
```javascript
// Animate multiple properties simultaneously
// Each track can animate different bones/properties
// Timeline interpolates all tracks together
```

### **Easing Functions**
```javascript
// Available easing types:
- linear      : Constant speed
- ease-in     : Slow start, fast end
- ease-out    : Fast start, slow end  
- ease-in-out : Slow start and end, fast middle
```

### **Loop and Timing**
```javascript
// Configure animation playback
- Loop: Repeat animation continuously
- Duration: Total animation time
- Frame Rate: Animation smoothness
- Speed: Playback rate multiplier
```

## 💡 **Tips & Best Practices**

1. **Start Simple** - Begin with basic bone rotations
2. **Use Key Poses** - Create main poses first, then add in-betweens
3. **Test Frequently** - Play back often to check timing
4. **Save Regularly** - Use Save button to persist changes
5. **Use Easing** - Apply easing for natural motion
6. **Record Mode** - Use auto-record for quick prototyping
7. **Manual Editing** - Use manual keyframes for precise control

## 🚀 **Next Steps**

The timeline component is ready for:
- ✅ Basic animation recording and playback
- ✅ Keyframe editing and manipulation  
- ✅ Multiple easing functions
- ✅ Real-time interpolation
- ✅ Save/load functionality

You can now create complex animations for your game characters! 🎮✨