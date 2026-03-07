package pluginimg

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"

	"github.com/justgook/wpm/pdk"
)

type openOutput struct {
	Handle int `json:"handle"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type createOutput = openOutput

type transformOutput struct {
	Handle int `json:"handle"`
	Width  int `json:"width"`
	Height int `json:"height"`
	Flip   int `json:"flip"`
}

type cropOutput struct {
	Handle int  `json:"handle"`
	Width  int  `json:"width"`
	Height int  `json:"height"`
	FlipX  bool `json:"flipX"`
	FlipY  bool `json:"flipY"`
}

type resizeOutput struct {
	Handle int `json:"handle"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type blitOutput = resizeOutput

type encodeOutput struct {
	Path         string `json:"path"`
	Format       string `json:"format"`
	BytesWritten int    `json:"bytesWritten"`
}

type readPixelsOutput struct {
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	ByteLength int    `json:"byteLength"`
	Encoding   string `json:"encoding"`
	Data       string `json:"data"`
}

type writePixelsOutput struct {
	Handle int `json:"handle"`
}

type HandleImage struct {
	Handle int
	Width  int
	Height int
}

func call(function string, input any, output any) error {
	payload, err := json.Marshal(input)
	if err != nil {
		return err
	}
	status, data, err := pdk.Call("image", function, payload)
	if err != nil {
		return err
	}
	if status != 0 {
		return fmt.Errorf("image.%s failed: %s", function, string(data))
	}
	if output != nil {
		return json.Unmarshal(data, output)
	}
	return nil
}

func Close(handle int) {
	_, _, _ = pdk.Call("image", "close", []byte(fmt.Sprintf(`{"src":%d}`, handle)))
}

func Open(path string) (HandleImage, error) {
	var opened openOutput
	if err := call("open", map[string]any{"path": path}, &opened); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: opened.Handle, Width: opened.Width, Height: opened.Height}, nil
}

func Create(width, height int, fill []int) (HandleImage, error) {
	input := map[string]any{"width": width, "height": height}
	if fill != nil {
		input["fill"] = fill
	}
	var created createOutput
	if err := call("create", input, &created); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: created.Handle, Width: created.Width, Height: created.Height}, nil
}

func Transform(src int, flip int) (HandleImage, error) {
	var out transformOutput
	if err := call("transform", map[string]any{"src": src, "flip": flip}, &out); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: out.Handle, Width: out.Width, Height: out.Height}, nil
}

func Crop(src int, x0, y0, x1, y1 int) (HandleImage, error) {
	var out cropOutput
	if err := call("crop", map[string]any{
		"src": src,
		"x0":  x0,
		"y0":  y0,
		"x1":  x1,
		"y1":  y1,
	}, &out); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: out.Handle, Width: out.Width, Height: out.Height}, nil
}

func Resize(src, width, height int, filter string) (HandleImage, error) {
	input := map[string]any{"src": src, "width": width, "height": height}
	if filter != "" {
		input["filter"] = filter
	}
	var out resizeOutput
	if err := call("resize", input, &out); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: out.Handle, Width: out.Width, Height: out.Height}, nil
}

func Blit(dst, src, x, y int) (HandleImage, error) {
	var out blitOutput
	if err := call("blit", map[string]any{"dst": dst, "src": src, "x": x, "y": y}, &out); err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: out.Handle, Width: out.Width, Height: out.Height}, nil
}

func Encode(src int, path, format string) (encodeOutput, error) {
	if format == "" {
		format = "qoi"
	}
	var out encodeOutput
	err := call("encode", map[string]any{"src": src, "path": path, "format": format}, &out)
	return out, err
}

func ReadPixels(src int) (readPixelsOutput, error) {
	var out readPixelsOutput
	err := call("read_pixels", map[string]any{"src": src}, &out)
	return out, err
}

func WritePixels(src, width, height int, dataBase64 string) (HandleImage, error) {
	var out writePixelsOutput
	err := call("write_pixels", map[string]any{
		"src":         src,
		"width":       width,
		"height":      height,
		"pixelFormat": "rgba8",
		"encoding":    "base64",
		"data":        dataBase64,
	}, &out)
	if err != nil {
		return HandleImage{}, err
	}
	return HandleImage{Handle: out.Handle, Width: width, Height: height}, nil
}

func LoadNRGBA(path string) (*image.NRGBA, error) {
	opened, err := Open(path)
	if err != nil {
		return nil, err
	}
	defer Close(opened.Handle)

	pixels, err := ReadPixels(opened.Handle)
	if err != nil {
		return nil, err
	}

	raw, err := base64.StdEncoding.DecodeString(pixels.Data)
	if err != nil {
		return nil, err
	}

	return &image.NRGBA{
		Pix:    raw,
		Stride: opened.Width * 4,
		Rect:   image.Rect(0, 0, opened.Width, opened.Height),
	}, nil
}

func SaveNRGBA(path string, img *image.NRGBA, format string) error {
	b := img.Bounds()
	created, err := Create(b.Dx(), b.Dy(), nil)
	if err != nil {
		return err
	}
	defer Close(created.Handle)

	written, err := WritePixels(created.Handle, b.Dx(), b.Dy(), base64.StdEncoding.EncodeToString(img.Pix))
	if err != nil {
		return err
	}
	defer Close(written.Handle)

	if format == "" {
		format = "qoi"
	}

	_, err = Encode(written.Handle, path, format)
	return err
}

func TransformNRGBA(img *image.NRGBA, flip int) (*image.NRGBA, error) {
	b := img.Bounds()
	created, err := Create(b.Dx(), b.Dy(), nil)
	if err != nil {
		return nil, err
	}
	defer Close(created.Handle)

	written, err := WritePixels(created.Handle, b.Dx(), b.Dy(), base64.StdEncoding.EncodeToString(img.Pix))
	if err != nil {
		return nil, err
	}
	defer Close(written.Handle)

	transformed, err := Transform(written.Handle, flip)
	if err != nil {
		return nil, err
	}
	defer Close(transformed.Handle)

	pixels, err := ReadPixels(transformed.Handle)
	if err != nil {
		return nil, err
	}

	raw, err := base64.StdEncoding.DecodeString(pixels.Data)
	if err != nil {
		return nil, err
	}

	return &image.NRGBA{
		Pix:    raw,
		Stride: transformed.Width * 4,
		Rect:   image.Rect(0, 0, transformed.Width, transformed.Height),
	}, nil
}
