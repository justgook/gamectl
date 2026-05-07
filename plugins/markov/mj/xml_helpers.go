package mj

import "encoding/xml"

func collectUnions(x xmlNode, waves map[byte]string) {
	if x.XMLName.Local == "union" {
		symbol := attr(x.Attrs, "symbol")
		values := attr(x.Attrs, "values")
		if len(symbol) == 1 && values != "" {
			waves[symbol[0]] = values
		}
	}
	for _, child := range x.Nodes {
		collectUnions(child, waves)
	}
}

func hasAnyAttr(attrs []xml.Attr, names ...string) bool {
	for _, name := range names {
		if attr(attrs, name) != "" {
			return true
		}
	}
	return false
}
