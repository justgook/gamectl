-- OPR Game Universes/Systems
-- Define the different game systems (Grimdark Future, Age of Fantasy, etc.)

DELETE FROM opr_universes;

INSERT INTO opr_universes (id, name,  version, description) VALUES
('grimdark-future', 'Grimdark Future',  'v3.5.1', 'Sci-fi tabletop wargame set in a war-torn galaxy'),
('age-of-fantasy', 'Age of Fantasy',  'v3.5.0', 'Fantasy tabletop wargame with magic and monsters');

