-- Skeleton animations table for 2D bone animation system
-- Stores animations as keyframes per bone, referencing skeleton poses

CREATE TABLE IF NOT EXISTS skeleton_animations (
    skeleton_name TEXT NOT NULL,
    animation_name TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (skeleton_name, animation_name)
);

-- Animation data format:
-- {
--   "duration": 2.0,           // Total duration in seconds
--   "loop": true,              // Whether animation loops
--   "keyframes": {
--     "root": [                // Root position keyframes
--       { "time": 0, "x": 0, "y": 0 },
--       { "time": 1, "x": 10, "y": 5 }
--     ],
--     "6": [                   // Bone index 6 angle keyframes
--       { "time": 0, "angle": -60 },
--       { "time": 0.5, "angle": -30 },
--       { "time": 1, "angle": -60 }
--     ]
--   }
-- }

-- Sample idle animation for humanoid
INSERT INTO skeleton_animations (skeleton_name, animation_name, data) VALUES
(
  'humanoid',
  'idle',
  '{
    "duration": 2.0,
    "loop": true,
    "keyframes": {}
  }'
);
