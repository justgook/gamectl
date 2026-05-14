#include "random_provider.h"

// Exported Functions from `wasi:random/random@0.2.0`
void exports_wasi_random_random_get_random_bytes(
    uint64_t len, random_provider_list_u8_t *ret) {}
uint64_t exports_wasi_random_random_get_random_u64(void) { return 42; }

// Exported Functions from `gams:random/seeded-random@1.0.0`
void exports_gams_random_seeded_random_set_seed(uint64_t seed) {}
uint64_t exports_gams_random_seeded_random_get_seed(void) { return 44; }
uint64_t exports_gams_random_seeded_random_get_generation(void) { return 45; }
