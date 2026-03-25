#ifndef GAMS_IMAGE_MAIN_H
#define GAMS_IMAGE_MAIN_H

/*
 * GAMS image plugin public API
 *
 * Module name: image
 * API version: image/v1
 *
 * Transport
 * ---------
 * - input: UTF-8 JSON bytes
 * - output: UTF-8 JSON bytes
 * - success: returnCode == 0
 * - failure: returnCode != 0 with JSON error payload
 * - calls use the standard GAMS plugin ABI through pdk.h
 *
 * PDK-backed dependencies used by this plugin
 * -------------------------------------------
 * - fs.read(path)
 * - fs.write(path + '\0' + data)
 * - host.log(message)
 *
 * Data model
 * ----------
 * - image handles are positive integers
 * - handle 0 is invalid
 * - all decoded images use pixelFormat = "rgba8"
 * - operations are immutable: transforms return a new handle
 *
 * Rectangle model
 * ---------------
 * Crop-like operations use edge coordinates:
 *   {"x0":4,"y0":8,"x1":20,"y1":24}
 *
 * Width and height are derived as:
 *   width  = abs(x1 - x0)
 *   height = abs(y1 - y0)
 *
 * Swapping x0/x1 or y0/y1 mirrors the sampled pixels while keeping the same
 * output dimensions.
 */

#define IMAGE_API_NAME "image"
#define IMAGE_API_VERSION "image/v1"
#define IMAGE_PIXEL_FORMAT_RGBA8 "rgba8"

/* Exported function names */
#define IMAGE_FN_OPEN "open"
#define IMAGE_FN_CREATE "create"
#define IMAGE_FN_INFO "info"
#define IMAGE_FN_CLONE "clone"
#define IMAGE_FN_TRANSFORM "transform"
#define IMAGE_FN_CROP "crop"
#define IMAGE_FN_RESIZE "resize"
#define IMAGE_FN_BLIT "blit"
#define IMAGE_FN_READ_PIXELS "read_pixels"
#define IMAGE_FN_READ_PIXELS_BIN "read_pixels_bin"
#define IMAGE_FN_EXPORT "export"
#define IMAGE_FN_WRITE_PIXELS "write_pixels"
#define IMAGE_FN_ENCODE "encode"
#define IMAGE_FN_CLOSE "close"
#define IMAGE_FN_CLOSE_ALL "close_all"

/* Common JSON field names */
#define IMAGE_FIELD_API "api"
#define IMAGE_FIELD_OK "ok"
#define IMAGE_FIELD_CODE "code"
#define IMAGE_FIELD_MESSAGE "message"
#define IMAGE_FIELD_HANDLE "handle"
#define IMAGE_FIELD_SRC "src"
#define IMAGE_FIELD_DST "dst"
#define IMAGE_FIELD_PATH "path"
#define IMAGE_FIELD_FORMAT "format"
#define IMAGE_FIELD_SOURCE_FORMAT "sourceFormat"
#define IMAGE_FIELD_PIXEL_FORMAT "pixelFormat"
#define IMAGE_FIELD_WIDTH "width"
#define IMAGE_FIELD_HEIGHT "height"
#define IMAGE_FIELD_X "x"
#define IMAGE_FIELD_Y "y"
#define IMAGE_FIELD_X0 "x0"
#define IMAGE_FIELD_Y0 "y0"
#define IMAGE_FIELD_X1 "x1"
#define IMAGE_FIELD_Y1 "y1"
#define IMAGE_FIELD_FLIP "flip"
#define IMAGE_FIELD_FLIP_X "flipX"
#define IMAGE_FIELD_FLIP_Y "flipY"
#define IMAGE_FIELD_FILL "fill"
#define IMAGE_FIELD_FILTER "filter"
#define IMAGE_FIELD_ENCODING "encoding"
#define IMAGE_FIELD_DATA "data"
#define IMAGE_FIELD_BYTE_LENGTH "byteLength"
#define IMAGE_FIELD_CLOSED "closed"

/* Error codes */
#define IMAGE_ERR_BAD_INPUT "bad_input"
#define IMAGE_ERR_NOT_FOUND "not_found"
#define IMAGE_ERR_INVALID_HANDLE "invalid_handle"
#define IMAGE_ERR_OUT_OF_BOUNDS "out_of_bounds"
#define IMAGE_ERR_DECODE_FAILED "decode_failed"
#define IMAGE_ERR_ENCODE_FAILED "encode_failed"
#define IMAGE_ERR_IO_FAILED "io_failed"
#define IMAGE_ERR_UNSUPPORTED_FORMAT "unsupported_format"
#define IMAGE_ERR_NOT_IMPLEMENTED "not_implemented"
#define IMAGE_ERR_OUT_OF_MEMORY "out_of_memory"
#define IMAGE_ERR_INTERNAL_ERROR "internal_error"

/*
 * Export documentation
 *
 * open
 *   request:  {"path":"/assets/sprite.png"}
 *   response: {"ok":true,"api":"image/v1","handle":1,"width":32,
 *              "height":48,"pixelFormat":"rgba8","sourceFormat":"png"}
 *
 * create
 *   request:  {"width":64,"height":64,"fill":[0,0,0,0]}
 *   response: {"ok":true,"api":"image/v1","handle":2,"width":64,
 *              "height":64,"pixelFormat":"rgba8"}
 *
 * info
 *   request:  {"src":1} or {"path":"/assets/sprite.qoi"}
 *   response: {"ok":true,"api":"image/v1","width":32,"height":48,
 *              "pixelFormat":"rgba8","sourceFormat":"qoi"}
 *
 * clone
 *   request:  {"src":1}
 *   response: {"ok":true,"api":"image/v1","handle":3,"width":32,
 *              "height":48,"pixelFormat":"rgba8"}
 *
 * transform
 *   request:  {"src":1,"flip":6}
 *   response: {"ok":true,"api":"image/v1","handle":4,"width":48,
 *              "height":32,"pixelFormat":"rgba8","flip":6}
 *   notes:    flip uses Tiled-style bits: 1=H, 2=V, 4=D
 *
 * crop
 *   request:  {"src":1,"x0":4,"y0":8,"x1":20,"y1":24}
 *   response: {"ok":true,"api":"image/v1","handle":4,"width":16,
 *              "height":16,"pixelFormat":"rgba8","flipX":false,
 *              "flipY":false}
 *
 * resize
 *   request:  {"src":1,"width":128,"height":128,"filter":"triangle"}
 *             if filter is omitted, default is "triangle"
 *   response: {"ok":true,"api":"image/v1","handle":5,"width":128,
 *              "height":128,"pixelFormat":"rgba8"}
 *
 * blit
 *   request:  {"dst":1,"src":2,"x":10,"y":12}
 *   response: {"ok":true,"api":"image/v1","handle":6,"width":128,
 *              "height":128,"pixelFormat":"rgba8"}
 *   notes:    x and y may be negative; out-of-bounds source pixels are clipped
 *
 * read_pixels
 *   request:  {"src":1}
 *   response: {"ok":true,"api":"image/v1","width":32,"height":48,
 *              "pixelFormat":"rgba8","byteLength":6144,
 *              "encoding":"base64","data":"..."}
 *
 * read_pixels_bin
 *   request:  {"src":1}
 *   response: raw rgba8 bytes only; use open/info for width and height metadata
 *
 * export
 *   request:  {"src":1,"format":"qoi"}
 *             if format is omitted, default is "qoi"
 *   response: raw encoded image bytes only
 *
 * write_pixels
 *   request:  {"src":1,"width":32,"height":48,"pixelFormat":"rgba8",
 *              "encoding":"base64","data":"..."}
 *   response: {"ok":true,"api":"image/v1","handle":7,"width":32,
 *              "height":48,"pixelFormat":"rgba8"}
 *   notes:    decoded data length must equal width * height * 4
 *
 * encode
 *   request:  {"src":1,"path":"/tmp/out.qoi","format":"qoi"}
 *             if format is omitted, default is "qoi"
 *   response: {"ok":true,"api":"image/v1","path":"/tmp/out.qoi",
 *              "format":"qoi","bytesWritten":1234}
 *
 * close
 *   request:  {"src":1}
 *   response: {"ok":true,"api":"image/v1","closed":1}
 *
 * close_all
 *   request:  {}
 *   response: {"ok":true,"api":"image/v1","closed":12}
 */

#endif
