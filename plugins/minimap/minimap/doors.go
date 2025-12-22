package minimap

// GenerateDoorsFromPaths extracts all door connections from path information
// This is a separate utility function that can be called after any stage that produces PathInfo
func GenerateDoorsFromPaths(pathInfos []PathInfo) []DoorConnection {
	var doors []DoorConnection

	for _, pathInfo := range pathInfos {
		doors = append(doors, pathInfo.Doors...)
	}

	return doors
}
