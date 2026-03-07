#ifndef GAMECTL_IMAGE_FREESTANDING_STRING_H
#define GAMECTL_IMAGE_FREESTANDING_STRING_H

#include <stddef.h>

#define memcpy(d, s, n) pdk_memcpy((d), (s), (pdk_u32)(n))
#define memset(d, v, n) image_memset_value((d), (v), (n))
#define memcmp(a, b, n) image_memcmp((a), (b), (n))

#endif
