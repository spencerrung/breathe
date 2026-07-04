use crate::util::XorShift;
use wasm_bindgen::prelude::*;

const FLOATS_PER_PARTICLE: usize = 4; // x, y, size, glow

// Fraction of particles that form the bright breathing ring; the rest fill
// the interior as soft mist so the orb reads as a body, not an outline.
const RING_FRACTION: f32 = 0.7;

struct Particle {
    theta: f32,
    omega: f32,      // slow angular drift, mixed directions
    band: f32,       // radial home as a multiple of the target radius
    r: f32,
    vr: f32,
    k: f32,          // spring stiffness (varied per particle for depth)
    c: f32,          // damping, near-critical — organic settle, no bounce
    size: f32,
    glow: f32,       // base color-mix weight, ring bright / mist dim
    shim_amp: f32,
    shim_freq: f32,
    shim_phase: f32,
}

#[wasm_bindgen]
pub struct BreathOrb {
    parts: Vec<Particle>,
    render: Vec<f32>,
    count: usize,
    w: f32,
    h: f32,
    t: f32,
}

#[wasm_bindgen]
impl BreathOrb {
    #[wasm_bindgen(constructor)]
    pub fn new(max_count: u32, width: f32, height: f32, seed: u32) -> BreathOrb {
        let max = max_count.max(1) as usize;
        let mut rng = XorShift::new(seed);
        let mut parts = Vec::with_capacity(max);

        for i in 0..max {
            let ring = (i as f32) < (max as f32) * RING_FRACTION;
            let (band, size, glow) = if ring {
                (
                    0.92 + 0.16 * rng.next_f32(),
                    2.6 + 2.4 * rng.next_f32(),
                    0.7 + 0.3 * rng.next_f32(),
                )
            } else {
                // sqrt biases the mist outward so density rises toward the ring
                (
                    0.15 + 0.75 * rng.next_f32().sqrt(),
                    2.0 + 2.0 * rng.next_f32(),
                    0.18 + 0.32 * rng.next_f32(),
                )
            };

            let k = 10.0 + 15.0 * rng.next_f32();
            let zeta = 0.9 + 0.1 * rng.next_f32();
            let dir = if rng.next() & 1 == 0 { 1.0 } else { -1.0 };

            parts.push(Particle {
                theta: rng.next_f32() * core::f32::consts::TAU,
                omega: dir * (0.02 + 0.06 * rng.next_f32()),
                band,
                r: band * 40.0, // bloom gently outward from a small seed radius
                vr: 0.0,
                k,
                c: 2.0 * k.sqrt() * zeta,
                size,
                glow,
                shim_amp: 2.0 + 3.0 * rng.next_f32(),
                shim_freq: 0.3 + 0.9 * rng.next_f32(),
                shim_phase: rng.next_f32() * core::f32::consts::TAU,
            });
        }

        BreathOrb {
            parts,
            render: vec![0.0; max * FLOATS_PER_PARTICLE],
            count: max,
            w: width,
            h: height,
            t: 0.0,
        }
    }

    pub fn set_count(&mut self, count: u32) {
        self.count = (count as usize).clamp(1, self.parts.len());
    }

    pub fn count(&self) -> u32 {
        self.count as u32
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        // Rescale radii so the orb keeps its proportion instead of springing
        // across the screen after a rotation or window resize.
        let old = self.w.min(self.h).max(1.0);
        let new = width.min(height).max(1.0);
        let ratio = new / old;
        for p in &mut self.parts {
            p.r *= ratio;
            p.vr *= ratio;
        }
        self.w = width;
        self.h = height;
    }

    /// dt: seconds (caller-clamped). target_radius: px, the eased breath
    /// radius from the TS engine. shimmer: 0..1 hold-phase agitation.
    /// energy: 0..1 liveliness — pausing softens drift and shimmer.
    pub fn step(&mut self, dt: f32, target_radius: f32, shimmer: f32, energy: f32) {
        self.t += dt;
        let t = self.t;
        let cx = self.w * 0.5;
        let cy = self.h * 0.5;
        let drift = 0.4 + 0.6 * energy;
        let agitation = 0.25 + 0.75 * shimmer;
        // Ring density falls as the orb expands; growing size/glow with the
        // radius keeps perceived light steady and avoids additive blowout at
        // rest. 0.4 mirrors the renderer's R_MAX fraction of min(w, h).
        let rel = (target_radius / (0.4 * self.w.min(self.h)).max(1.0)).clamp(0.0, 1.2);
        let size_scale = 0.65 + 0.6 * rel;
        let glow_scale = 0.55 + 0.45 * rel;

        for (i, p) in self.parts[..self.count].iter_mut().enumerate() {
            p.theta += p.omega * drift * dt;

            let home = target_radius * p.band;
            let ar = p.k * (home - p.r) - p.c * p.vr;
            p.vr += ar * dt;
            p.r += p.vr * dt;

            let amp = p.shim_amp * agitation * (0.4 + 0.6 * energy);
            let radial = amp * (p.shim_freq * t + p.shim_phase).sin();
            let tangential = amp * 0.6 * (p.shim_freq * 0.63 * t + 1.7 * p.shim_phase).sin();

            let (s, c) = p.theta.sin_cos();
            let rr = p.r + radial;
            let x = cx + rr * c - tangential * s;
            let y = cy + rr * s + tangential * c;

            let twinkle = 0.85 + 0.15 * (0.4 * p.shim_freq * t + 2.0 * p.shim_phase).sin();
            let glow = (p.glow * twinkle * glow_scale).clamp(0.0, 1.0);

            let o = i * FLOATS_PER_PARTICLE;
            self.render[o] = x;
            self.render[o + 1] = y;
            self.render[o + 2] = p.size * size_scale;
            self.render[o + 3] = glow;
        }
    }

    pub fn data_ptr(&self) -> *const f32 {
        self.render.as_ptr()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_converges_to_target_radius() {
        let mut orb = BreathOrb::new(2000, 800.0, 600.0, 42);
        let target = 200.0;
        for _ in 0..300 {
            orb.step(1.0 / 60.0, target, 0.0, 1.0);
        }
        // Mean of r/band should approach the target radius within 2%.
        let mean: f32 = orb.parts.iter().map(|p| p.r / p.band).sum::<f32>() / orb.parts.len() as f32;
        assert!(
            (mean - target).abs() < target * 0.02,
            "mean normalized radius {mean} not within 2% of {target}"
        );
    }

    #[test]
    fn render_buffer_finite_and_in_bounds() {
        let (w, h) = (800.0f32, 600.0f32);
        let mut orb = BreathOrb::new(2000, w, h, 7);
        // Exercise expansion, hold shimmer, and contraction.
        for i in 0..600 {
            let target = if i < 200 { 220.0 } else if i < 400 { 220.0 } else { 60.0 };
            let shimmer = if (200..400).contains(&i) { 1.0 } else { 0.15 };
            orb.step(1.0 / 60.0, target, shimmer, 1.0);
        }
        let margin = 60.0;
        for i in 0..orb.count {
            let o = i * FLOATS_PER_PARTICLE;
            let (x, y, size, glow) = (
                orb.render[o],
                orb.render[o + 1],
                orb.render[o + 2],
                orb.render[o + 3],
            );
            assert!(x.is_finite() && y.is_finite() && size.is_finite() && glow.is_finite());
            assert!((-margin..=w + margin).contains(&x), "x {x} out of bounds");
            assert!((-margin..=h + margin).contains(&y), "y {y} out of bounds");
            assert!((0.0..=1.0).contains(&glow));
        }
    }

    #[test]
    fn xorshift_stays_in_unit_interval() {
        let mut rng = XorShift::new(1);
        for _ in 0..10_000 {
            let v = rng.next_f32();
            assert!((0.0..1.0).contains(&v));
        }
    }
}
