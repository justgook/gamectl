export function createDefaultTimeline() {
  const defaultTimeline = {
    name: 'default_timeline',
    duration: 2.0,
    frameRate: 30,
    loop: true,
    tracks: [
      {
        targetType: 'skeleton',
        targetId: 'humanoid',
        targetPath: 'bones.0.a',
        keyframes: [
          { time: 0.0, value: 90, easing: 'linear' },
          { time: 1.0, value: 45, easing: 'ease-in-out' },
          { time: 2.0, value: 90, easing: 'linear' }
        ]
      },
      {
        targetType: 'skeleton', 
        targetId: 'humanoid',
        targetPath: 'bones.1.a',
        keyframes: [
          { time: 0.0, value: 0, easing: 'linear' },
          { time: 0.5, value: 15, easing: 'ease-out' },
          { time: 1.5, value: -10, easing: 'ease-in' },
          { time: 2.0, value: 0, easing: 'linear' }
        ]
      }
    ],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'system'
    }
  }
  
  return defaultTimeline
}

export function initializeTimelineStorage(bus) {
  // The default timeline is now created automatically via SQL file
  // We just need to ensure the timeline component can load it
  console.log('Timeline storage initialization complete - default timeline created via SQL')
}