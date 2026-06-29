/// Core image buffer — the shared pixel data that all modules operate on.
///
/// RGBA, row-major, 4 bytes per pixel.

#[derive(Clone)]
pub struct ImageBuffer {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

impl ImageBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            data: vec![0u8; (width * height * 4) as usize],
        }
    }

    pub fn load(&mut self, pixels: &[u8]) -> bool {
        if pixels.len() == self.data.len() {
            self.data.copy_from_slice(pixels);
            true
        } else {
            false
        }
    }

    /// Bilinear sample at fractional coordinates. Clamps to edges.
    ///
    /// Interpolation happens in **linear light** (sRGB gamma removed) with
    /// **premultiplied alpha**, then the result is un-premultiplied and
    /// re-encoded to sRGB. This avoids the two classic downscaling artefacts:
    /// averaging in gamma space darkens midtones/edges, and interpolating
    /// straight (non-premultiplied) RGB lets fully-transparent pixels bleed
    /// their colour into the result (edge fringing).
    pub fn sample_bilinear(&self, fx: f64, fy: f64) -> [u8; 4] {
        if self.width == 0 || self.height == 0 {
            return [0, 0, 0, 0];
        }
        let w = self.width as i32;
        let h = self.height as i32;
        let x0 = fx.floor() as i32;
        let y0 = fy.floor() as i32;
        let tx = fx - fx.floor();
        let ty = fy - fy.floor();

        // Fetch a corner as linear-light, premultiplied [r, g, b, a] in 0..=1.
        let pixel = |xi: i32, yi: i32| -> [f64; 4] {
            let xi = xi.clamp(0, w - 1) as usize;
            let yi = yi.clamp(0, h - 1) as usize;
            let idx = (yi * self.width as usize + xi) * 4;
            let a = self.data[idx + 3] as f64 / 255.0;
            [
                srgb_to_linear(self.data[idx] as f64 / 255.0) * a,
                srgb_to_linear(self.data[idx + 1] as f64 / 255.0) * a,
                srgb_to_linear(self.data[idx + 2] as f64 / 255.0) * a,
                a,
            ]
        };

        let p00 = pixel(x0, y0);
        let p10 = pixel(x0 + 1, y0);
        let p01 = pixel(x0, y0 + 1);
        let p11 = pixel(x0 + 1, y0 + 1);

        let lerp = |a: f64, b: f64, t: f64| a + (b - a) * t;
        let bi = |i: usize| lerp(lerp(p00[i], p10[i], tx), lerp(p01[i], p11[i], tx), ty);

        let a = bi(3);
        if a <= 0.0 {
            return [0, 0, 0, 0];
        }
        // Un-premultiply, convert linear → sRGB, quantise.
        let to_u8 = |lin_pm: f64| {
            (linear_to_srgb((lin_pm / a).clamp(0.0, 1.0)) * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8
        };
        [
            to_u8(bi(0)),
            to_u8(bi(1)),
            to_u8(bi(2)),
            (a * 255.0).round().clamp(0.0, 255.0) as u8,
        ]
    }
}

/// sRGB transfer function: gamma-encoded [0,1] → linear light [0,1].
fn srgb_to_linear(c: f64) -> f64 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// Inverse sRGB transfer function: linear light [0,1] → gamma-encoded [0,1].
fn linear_to_srgb(c: f64) -> f64 {
    if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

#[cfg(test)]
mod core_tests {
    use super::*;

    /// Midpoint of black↔white must average in linear light (~188 sRGB),
    /// NOT in gamma space (~128). Proves gamma-correct sampling.
    #[test]
    fn bilinear_midpoint_is_gamma_correct() {
        let buf = ImageBuffer {
            width: 2,
            height: 1,
            data: vec![0, 0, 0, 255, 255, 255, 255, 255],
        };
        let [r, g, b, a] = buf.sample_bilinear(0.5, 0.0);
        assert!(
            (185..=190).contains(&r),
            "r={r} (expected ~188, gamma-correct)"
        );
        assert_eq!([g, b, a], [r, r, 255]);
    }

    /// A fully-transparent pixel must not bleed its RGB into an opaque
    /// neighbour. Midpoint of transparent-black ↔ opaque-red stays pure red.
    #[test]
    fn bilinear_premultiplied_no_color_bleed() {
        let buf = ImageBuffer {
            width: 2,
            height: 1,
            data: vec![0, 0, 0, 0, 255, 0, 0, 255],
        };
        let [r, g, b, a] = buf.sample_bilinear(0.5, 0.0);
        assert!(r >= 250, "r={r} (transparent black bled in; expected ~255)");
        assert_eq!([g, b], [0, 0]);
        assert!((126..=129).contains(&a), "a={a} (expected ~128)");
    }

    /// Downscaling a solid colour must return that exact colour (round-trip
    /// through linear/premultiplied space introduces no drift).
    #[test]
    fn bilinear_solid_color_is_stable() {
        let buf = ImageBuffer {
            width: 2,
            height: 2,
            data: [120u8, 200, 60, 255].repeat(4),
        };
        assert_eq!(buf.sample_bilinear(0.5, 0.5), [120, 200, 60, 255]);
    }
}
