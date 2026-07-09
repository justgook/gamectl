package world

import "../director"

@(private = "file")
MOCK_DIRECTOR_PLAYER :: director.Entity_Id(0)

@(private = "file")
MOCK_DIRECTOR_HP :: director.Word_Id(0)

@(private = "file")
mock_director_player_stats := [?]director.Stat {
	{key = MOCK_DIRECTOR_HP, value = 100},
}

@(private = "file")
mock_director_entities := [?]director.Entity_Def {
	{id = MOCK_DIRECTOR_PLAYER, stats = mock_director_player_stats[:]},
}

@(private = "file")
mock_director_words := [?]string {
	"hp",
}

MOCK_DIRECTOR_DATA: director.Director_Data = {
	entities = mock_director_entities[:],
	words    = mock_director_words[:],
}
