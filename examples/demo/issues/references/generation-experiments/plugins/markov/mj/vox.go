package mj

import (
	"encoding/binary"
	"fmt"
	"path"
)

type voxData struct {
	W, H, D int
	Data    []uint32
}

func loadVox(opts ParseOptions, parts ...string) (voxData, error) {
	if opts.ReadFile == nil {
		return voxData{}, fmt.Errorf("vox requires ReadFile")
	}
	p := path.Join(append([]string{opts.ResourceRoot}, parts...)...)
	data, err := opts.ReadFile(p)
	if err != nil {
		return voxData{}, err
	}
	return decodeVox(data, p)
}

func decodeVox(data []byte, label string) (voxData, error) {
	if len(data) < 8 || string(data[:4]) != "VOX " {
		return voxData{}, fmt.Errorf("%s is not a VOX file", label)
	}
	pos := 8
	var out voxData
	for pos+12 <= len(data) {
		id := string(data[pos : pos+4])
		content := int(binary.LittleEndian.Uint32(data[pos+4 : pos+8]))
		_ = int(binary.LittleEndian.Uint32(data[pos+8 : pos+12]))
		pos += 12
		end := pos + content
		if end > len(data) {
			return voxData{}, fmt.Errorf("%s has truncated chunk", label)
		}
		switch id {
		case "SIZE":
			if content >= 12 {
				out.W = int(binary.LittleEndian.Uint32(data[pos : pos+4]))
				out.H = int(binary.LittleEndian.Uint32(data[pos+4 : pos+8]))
				out.D = int(binary.LittleEndian.Uint32(data[pos+8 : pos+12]))
				out.Data = make([]uint32, out.W*out.H*out.D)
			}
		case "XYZI":
			if content >= 4 && out.Data != nil {
				count := int(binary.LittleEndian.Uint32(data[pos : pos+4]))
				q := pos + 4
				for i := 0; i < count && q+4 <= end; i++ {
					x, y, z, c := int(data[q]), int(data[q+1]), int(data[q+2]), uint32(data[q+3])
					q += 4
					if x >= 0 && x < out.W && y >= 0 && y < out.H && z >= 0 && z < out.D {
						out.Data[x+y*out.W+z*out.W*out.H] = c
					}
				}
			}
		}
		pos = end
	}
	if out.Data == nil {
		return voxData{}, fmt.Errorf("%s missing SIZE/XYZI", label)
	}
	return out, nil
}
