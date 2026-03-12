#define SOKOL_GLES3
#define SOKOL_EXTERNAL_GL_LOADER
#define IMPL

#include "../game/web/wasm-include/GLES3/gl3.h"
#include "../game/web/wasm-include/gl_funcs.h"

static float game2_absf(float x) {
	return x < 0.0f ? -x : x;
}

static float game2_wrap_pi(float x) {
	const float pi = 3.14159265358979323846f;
	const float tau = 6.28318530717958647692f;
	while (x > pi) {
		x -= tau;
	}
	while (x < -pi) {
		x += tau;
	}
	return x;
}

float sinf(float x) {
	const float b = 1.27323954473516268615f;
	const float c = -0.40528473456935108578f;
	const float p = 0.225f;
	float y;

	x = game2_wrap_pi(x);
	y = b * x + c * x * game2_absf(x);
	return p * (y * game2_absf(y) - y) + y;
}

float cosf(float x) {
	return sinf(x + 1.57079632679489661923f);
}

#include "sokol/c/sokol_gfx.c"
