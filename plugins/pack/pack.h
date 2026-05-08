#ifndef GAMS_PACK_H
#define GAMS_PACK_H

/*
 * GAMS pack plugin public API
 *
 * Module name: pack
 * API version: pack/v1
 *
 * Transport
 * ---------
 * - input: UTF-8 JSON bytes
 * - output: UTF-8 JSON bytes
 * - success: returnCode == 0
 * - failure: returnCode != 0 with JSON error payload
 * - calls use the standard GAMS plugin ABI through pdk.h
 *
 * Data model
 * ----------
 * - rectangle packing is stateless: each call packs one target area
 * - rectangles are axis-aligned and are not rotated
 * - response order matches request order
 * - x and y are packed origin coordinates in the target area
 * - partial packing is reported in-band via packedAll/packedCount/failedCount
 *
 * Packing model
 * -------------
 * - width and height define the target area to pack into
 * - padding is the spacing inserted between packed rectangles
 * - rect width and height describe the content size requested by the caller
 * - returned x and y describe the content origin after packing
 */

#define PACK_API_NAME "pack"
#define PACK_API_VERSION "pack/v1"

/* Exported function names */
#define PACK_FN_PACK "pack"

/* Common JSON field names */
#define PACK_FIELD_API "api"
#define PACK_FIELD_CODE "code"
#define PACK_FIELD_MESSAGE "message"
#define PACK_FIELD_WIDTH "width"
#define PACK_FIELD_HEIGHT "height"
#define PACK_FIELD_PADDING "padding"
#define PACK_FIELD_AUTO_SIZE "autoSize"
#define PACK_FIELD_RECTS "rects"
#define PACK_FIELD_ID "id"
#define PACK_FIELD_X "x"
#define PACK_FIELD_Y "y"
#define PACK_FIELD_PACKED "packed"
#define PACK_FIELD_PACKED_ALL "packedAll"
#define PACK_FIELD_PACKED_COUNT "packedCount"
#define PACK_FIELD_FAILED_COUNT "failedCount"

/* Error codes */
#define PACK_ERR_BAD_INPUT "bad_input"
#define PACK_ERR_UNSUPPORTED_OPTION "unsupported_option"
#define PACK_ERR_OUT_OF_RANGE "out_of_range"
#define PACK_ERR_OUT_OF_MEMORY "out_of_memory"
#define PACK_ERR_INTERNAL_ERROR "internal_error"

/*
 * Export documentation
 *
 * pack
 *   request:  {"width":256,"height":256,"padding":1,"autoSize":true,
 *              "rects":[
 *                {"id":1,"width":32,"height":16},
 *                {"id":2,"width":64,"height":64}
 *              ]}
 *   response: {"api":"pack/v1","width":256,"height":256,"padding":1,
 *              "packedAll":true,"packedCount":2,"failedCount":0,
 *              "rects":[
 *                {"id":1,"x":0,"y":0,"width":32,"height":16,
 *                 "packed":true},
 *                {"id":2,"x":33,"y":0,"width":64,"height":64,
 *                 "packed":true}
 *              ]}
 *   notes:    if a rectangle does not fit, it is returned with
 *             "packed":false and without valid placement coordinates
 *   notes:    if autoSize is true, the plugin grows the atlas to the
 *             smallest square power-of-two size that fits all rectangles,
 *             starting from the provided width and height as minimum bounds
 *   notes:    the plugin reports packing status in the response payload;
 *             returnCode != 0 is reserved for invalid input or runtime errors
 */

#endif
