/// Core image buffer — the shared pixel data that all modules operate on.
///
/// RGBA, row-major, 4 bytes per pixel.

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

    pub fn get_data(&self) -> &[u8] {
        &self.data
    }

    /// Bilinear sample at fractional coordinates. Clamps to edges.
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

        let pixel = |xi: i32, yi: i32| -> [f64; 4] {
            let xi = xi.clamp(0, w - 1) as usize;
            let yi = yi.clamp(0, h - 1) as usize;
            let idx = (yi * self.width as usize + xi) * 4;
            [
                self.data[idx] as f64,
                self.data[idx + 1] as f64,
                self.data[idx + 2] as f64,
                self.data[idx + 3] as f64,
            ]
        };

        let [r00, g00, b00, a00] = pixel(x0, y0);
        let [r10, g10, b10, a10] = pixel(x0 + 1, y0);
        let [r01, g01, b01, a01] = pixel(x0, y0 + 1);
        let [r11, g11, b11, a11] = pixel(x0 + 1, y0 + 1);

        let lerp = |a: f64, b: f64, t: f64| a + (b - a) * t;
        let bi = |v00: f64, v10: f64, v01: f64, v11: f64| {
            lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty)
        };

        [
            bi(r00, r10, r01, r11).round().clamp(0.0, 255.0) as u8,
            bi(g00, g10, g01, g11).round().clamp(0.0, 255.0) as u8,
            bi(b00, b10, b01, b11).round().clamp(0.0, 255.0) as u8,
            bi(a00, a10, a01, a11).round().clamp(0.0, 255.0) as u8,
        ]
    }
}
