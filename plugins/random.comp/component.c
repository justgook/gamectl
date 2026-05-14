#include "random_provider.h"

#include <stdint.h>
#include <stdlib.h>

static const uint64_t WEYL_STEP = UINT64_C(0x9e3779b97f4a7c15);

static uint64_t current_seed = UINT64_C(0x853c49e6748fea9b);
static uint64_t generation = 0;

static uint64_t splitmix64_mix(uint64_t value) {
  value = (value ^ (value >> 30)) * UINT64_C(0xbf58476d1ce4e5b9);
  value = (value ^ (value >> 27)) * UINT64_C(0x94d049bb133111eb);
  return value ^ (value >> 31);
}

static uint64_t next_u64(void) {
  uint64_t position = generation + 1;
  uint64_t value = current_seed + (WEYL_STEP * position);
  generation = position;
  return splitmix64_mix(value);
}

// Exported Functions from `wasi:random/random@0.2.0`
void exports_wasi_random_random_get_random_bytes(
    uint64_t len, random_provider_list_u8_t *ret) {
  if (len == 0) {
    ret->ptr = NULL;
    ret->len = 0;
    return;
  }

  if (len > (uint64_t)SIZE_MAX)
    abort();

  uint8_t *bytes = malloc((size_t)len);
  if (bytes == NULL)
    abort();

  uint64_t offset = 0;
  while (offset < len) {
    uint64_t word = next_u64();
    for (uint32_t i = 0; i < 8 && offset < len; i++) {
      bytes[offset++] = (uint8_t)(word & UINT64_C(0xff));
      word >>= 8;
    }
  }

  ret->ptr = bytes;
  ret->len = (size_t)len;
}

uint64_t exports_wasi_random_random_get_random_u64(void) { return next_u64(); }

// Exported Functions from `gams:random/seeded-random@1.0.0`
void exports_gams_random_seeded_random_set_seed(uint64_t seed) {
  current_seed = seed;
  generation = 0;
}

uint64_t exports_gams_random_seeded_random_get_seed(void) {
  return current_seed;
}
uint64_t exports_gams_random_seeded_random_get_generation(void) {
  return generation;
}
