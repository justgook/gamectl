-- Timeline storage for animation data
-- Follows established pattern of name/data structure
CREATE TABLE IF NOT EXISTS timeline_storage (
  name TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

-- Insert default timeline data
INSERT OR IGNORE INTO timeline_storage (name, data) VALUES ('default_timeline', '{
  "name": "default_timeline",
  "duration": 2.0,
  "frameRate": 30,
  "loop": true,
  "tracks": [
    {
      "targetType": "skeleton",
      "targetId": "humanoid",
      "targetPath": "bones.0.a",
      "keyframes": [
        { "time": 0.0, "value": 90, "easing": "linear" },
        { "time": 1.0, "value": 45, "easing": "ease-in-out" },
        { "time": 2.0, "value": 90, "easing": "linear" }
      ]
    },
    {
      "targetType": "skeleton", 
      "targetId": "humanoid",
      "targetPath": "bones.1.a",
      "keyframes": [
        { "time": 0.0, "value": 0, "easing": "linear" },
        { "time": 0.5, "value": 15, "easing": "ease-out" },
        { "time": 1.5, "value": -10, "easing": "ease-in" },
        { "time": 2.0, "value": 0, "easing": "linear" }
      ]
    }
  ],
  "metadata": {
    "created": "2026-01-06T00:00:00.000Z",
    "modified": "2026-01-06T00:00:00.000Z",
    "author": "system"
  }
}');
