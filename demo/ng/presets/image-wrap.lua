local image = json.decode(inputs[1])
outputs[1] = json.encode({ _file = "image:" .. image.handle })

