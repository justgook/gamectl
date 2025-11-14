// PCG32 state - high quality pseudorandom number generator
var state: u64 = 0x853c49e6748fea9b;
var inc: u64 = 0xda3e39cb94b95bdb;

export fn setSeed(seed_value: u32) void {
    state = @as(u64, seed_value) | (@as(u64, seed_value) << 32);
    inc = 0xda3e39cb94b95bdb;
    // Advance the state once to mix the seed
    _ = next32();
}

export fn seed() u32 {
    return @as(u32, @truncate(state));
}

// Generate next 32-bit random number using PCG32 algorithm
fn next32() u32 {
    const oldstate: u64 = state;
    // PCG step: state = state * multiplier + increment
    state = oldstate *% 6364136223846793005 +% inc;

    // PCG output function: XOR-shift and rotate
    const xorshifted: u32 = @as(u32, @truncate(((oldstate >> 18) ^ oldstate) >> 27));
    const rot: u32 = @as(u32, @truncate(oldstate >> 59));

    return (xorshifted >> @as(u5, @truncate(rot))) | (xorshifted << @as(u5, @truncate((-%rot) & 31)));
}

// Equivalent to Go's rand.Intn() with bias elimination
export fn intn(n: u32) u32 {
    if (n == 0) return 0;
    if (n == 1) return 0;

    // Use rejection sampling to eliminate bias
    // This is the same approach Go uses
    const max = (~@as(u32, 0) / n) * n;

    while (true) {
        const v = next32();
        if (v < max) {
            return v % n;
        }
    }
}

// Generate a random float64 in [0.0, 1.0) - equivalent to Go's rand.Float64()
export fn float64() f64 {
    // Use two 32-bit values to get full 64-bit precision
    const a = next32() >> 5; // Top 27 bits
    const b = next32() >> 6; // Top 26 bits
    return (@as(f64, @floatFromInt(a)) * 0x1.0p-27 + @as(f64, @floatFromInt(b))) * 0x1.0p-26;
}

// Generate a random float32 in [0.0, 1.0) - equivalent to Go's rand.Float32()
export fn float32() f32 {
    return @as(f32, @floatFromInt(next32() >> 8)) * 0x1.0p-24;
}

// Legacy function name for compatibility
export fn next() f32 {
    return float32();
}
