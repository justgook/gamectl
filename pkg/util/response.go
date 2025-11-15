package util

import "encoding/json"

type Response struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func SuccessResponse() []byte {
	resp := Response{Success: true}
	data, _ := json.Marshal(resp)
	return data
}

func ErrorResponse(msg string) []byte {
	resp := Response{Success: false, Error: msg}
	data, _ := json.Marshal(resp)
	return data
}
