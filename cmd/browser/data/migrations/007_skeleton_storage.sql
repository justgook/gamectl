-- +goose Up
-- Migration: skeleton_storage
-- Skeleton storage table for 2D bone animation system

CREATE TABLE IF NOT EXISTS skeleton_storage (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

-- Sample humanoid skeleton
INSERT INTO skeleton_storage (name, data) VALUES
(
  'humanoid',
  '{
    "name": "humanoid",
    "x": 0,
    "y": 0,
    "props": {
      "0": {"name": "root"},
      "1": {"name": "spine"},
      "2": {"name": "chest"},
      "3": {"name": "neck"},
      "4": {"name": "head"},
      "5": {"name": "shoulder_l"},
      "6": {"name": "arm_upper_l"},
      "7": {"name": "arm_lower_l"},
      "8": {"name": "hand_l"},
      "9": {"name": "shoulder_r"},
      "10": {"name": "arm_upper_r"},
      "11": {"name": "arm_lower_r"},
      "12": {"name": "hand_r"},
      "13": {"name": "hip_l"},
      "14": {"name": "leg_upper_l"},
      "15": {"name": "leg_lower_l"},
      "16": {"name": "foot_l"},
      "17": {"name": "hip_r"},
      "18": {"name": "leg_upper_r"},
      "19": {"name": "leg_lower_r"},
      "20": {"name": "foot_r"}
    },
    "bones": [
      {"parent": null, "a": 90, "l": 0},
      {"parent": 0, "a": 0, "l": 40},
      {"parent": 1, "a": 0, "l": 40},
      {"parent": 2, "a": 0, "l": 20},
      {"parent": 3, "a": 0, "l": 25},
      {"parent": 2, "a": 30, "l": 15},
      {"parent": 5, "a": -60, "l": 35},
      {"parent": 6, "a": -20, "l": 30},
      {"parent": 7, "a": 0, "l": 15},
      {"parent": 2, "a": 150, "l": 15},
      {"parent": 9, "a": 60, "l": 35},
      {"parent": 10, "a": 20, "l": 30},
      {"parent": 11, "a": 0, "l": 15},
      {"parent": 0, "a": -150, "l": 15},
      {"parent": 13, "a": -20, "l": 45},
      {"parent": 14, "a": 0, "l": 40},
      {"parent": 15, "a": 70, "l": 20},
      {"parent": 0, "a": -30, "l": 15},
      {"parent": 17, "a": 20, "l": 45},
      {"parent": 18, "a": 0, "l": 40},
      {"parent": 19, "a": -70, "l": 20}
    ],
    "poses": {
      "default": {
        "x": 0,
        "y": 0,
        "angles": {}
      }
    }
  }'
);
