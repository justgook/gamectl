-- +goose Up
-- Migration: opr_universes
-- OPR Game Universes/Systems

INSERT INTO opr_universes (id, name, version, description) VALUES
('grimdark-future', 'Grimdark Future', 'v3.5.1', 'Sci-fi tabletop wargame set in a war-torn galaxy'),
('age-of-fantasy', 'Age of Fantasy', 'v3.5.0', 'Fantasy tabletop wargame with magic and monsters');
