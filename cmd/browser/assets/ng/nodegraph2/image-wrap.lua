local metadata = json.decode(inputs[1]) 
outputs[1] = "{\"_file\":\"image:"..metadata.handle.."\"}"