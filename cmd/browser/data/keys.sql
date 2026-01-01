-- Keys/abilities storage table for key-lock progression system
-- Keys represent abilities, items, or skills that unlock new areas

CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Clear existing keys (for development - allows re-running migration)
DELETE FROM keys;

-- Insert keys (migrated from keys.json)
INSERT INTO keys (name, description) VALUES
('Magnetic Boots', 'Heavy metallic footwear that allows you to walk on walls and ceilings of ferrous structures, leaving spark trails behind'),
('Cyber Dash', 'Neural implant that overclocks your movement processors, allowing you to dash through short distances in a blur of static'),
('Double Jump Boosters', 'Compact rocket thrusters mounted on your back that provide a second burst of propulsion while airborne'),
('Phase Cloak', 'Experimental technology that shifts your molecular frequency, allowing brief passage through solid matter'),
('Adrenaline Injector', 'Automated medical system that floods your bloodstream with combat stimulants when health drops below critical levels'),
('Hack Roll', 'Combat subroutine that temporarily digitizes your body, allowing you to roll through enemies and obstacles as a data stream'),
('Shock Absorption Gel', 'Bioengineered padding that hardens on impact, completely negating fall damage and reducing collision injuries'),
('Network Tap', 'Portable device that can interface with any electronic lock, door, or terminal through wireless infiltration protocols'),
('Atmospheric Scanner', 'Multi-spectrum analyzer that reveals hidden passages, weak structural points, and environmental hazards through augmented reality'),
('Wall Crawler Nanobots', 'Microscopic robots that coat your hands and feet, allowing you to climb any surface like a mechanical spider'),
('Sonic Pulser', 'Wrist-mounted device that generates focused sound waves capable of shattering glass and stunning electronic systems'),
('Memory Extractor', 'Neural interface that can download and view the final moments of deceased androids and cyborgs'),
('Thermal Vision Implants', 'Cybernetic eye modifications that reveal heat signatures through walls and detect invisible laser security systems'),
('Electromagnetic Pulse', 'Shoulder-mounted generator that can disable all electronics in a wide radius, though it drains your own power systems'),
('Gravity Manipulator', 'Experimental wrist device that can temporarily alter local gravity, allowing you to walk on walls or create zero-G fields'),
('Data Dive', 'Ability to temporarily upload your consciousness into the global network, moving instantly between connected terminals'),
('Reactive Armor Plates', 'Smart armor that automatically shifts and adjusts to absorb incoming damage, becoming temporarily stronger with each hit'),
('Signal Jammer', 'Personal ECM device that makes you invisible to electronic detection while scrambling nearby communication systems'),
('Nano Repair Swarm', 'Self-replicating repair bots that slowly restore your health and fix damaged equipment over time'),
('Overclock Protocol', 'Emergency subroutine that temporarily doubles your processing speed, making everything else appear to move in slow motion'),
('Plasma Cutter Arm', 'Retractable limb modification that can slice through most materials and create new pathways through obstacles'),
('Stealth Field Generator', 'Energy-intensive device that bends light around your body, rendering you nearly invisible for short periods'),
('Biometric Spoofer', 'Sophisticated device that can replicate any fingerprint, retinal pattern, or DNA signature for accessing secure areas'),
('Quantum Entangler', 'Rare technology that creates a temporary link between two locations, allowing instantaneous travel across short distances'),
('Neural Bridge', 'Ability to directly interface with any AI or computer system through thought alone, bypassing traditional input methods'),
('Radiation Immunity', 'Genetic modification that allows you to walk through toxic zones and radioactive areas without any protective equipment'),
('Underwater Breathing', 'Artificial gill implants that extract oxygen from any liquid, allowing indefinite exploration of flooded areas'),
('Faction Diplomacy', 'Social programming that allows you to negotiate safe passage through bandit camps and hostile settlements'),
('Machine Whisperer', 'Neural interface that lets you communicate with and command autonomous robots and factory systems'),
('Seismic Slam', 'Hydraulic leg enhancers that can create shockwaves to break through weak floors and stun nearby enemies'),
('Photosynthetic Skin', 'Bioengineered skin modification that slowly regenerates health when exposed to any form of artificial or natural light'),
('Tunnel Vision', 'Echolocation implants that reveal hidden passages and structural weaknesses through sonar mapping'),
('Trade Network Access', 'Encrypted communication device that connects you to merchant networks for buying and selling rare components'),
('Toxic Resistance', 'Liver and lung modifications that neutralize most chemical hazards and allow breathing in contaminated atmospheres'),
('Solar Charging', 'Photovoltaic skin patches that convert any light source into power for your cybernetic systems'),
('Vault Breaker', 'Specialized tool set designed specifically for opening pre-war security doors and corporate safes'),
('Animal Companion Link', 'Pheromone dispenser and neural transmitter that allows you to befriend and communicate with mutant creatures'),
('Scrap Crafting', 'Integrated fabrication tools in your arms that can combine junk items into useful equipment and ammunition'),
('Deep Diving Gear', 'Pressure suit and breathing apparatus that enables exploration of flooded underground complexes');
