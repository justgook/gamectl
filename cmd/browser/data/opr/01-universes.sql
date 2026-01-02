-- OPR Game Universes/Systems
-- Define the different game systems (Grimdark Future, Age of Fantasy, etc.)

DELETE FROM opr_universes;

INSERT INTO opr_universes (id, name, short_name, version, description) VALUES
('grimdark-future', 'Grimdark Future', 'GF', 'v3.5.1', 'Sci-fi tabletop wargame set in a war-torn galaxy'),
('age-of-fantasy', 'Age of Fantasy', 'AoF', 'v3.5.0', 'Fantasy tabletop wargame with magic and monsters');
