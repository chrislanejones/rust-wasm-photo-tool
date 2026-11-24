//! The swatch grids' checkerboard swatch stores the CSS keyword
//! `transparent`, not a hex. Both color parsers read it as alpha 0, so a
//! transparent fill draws nothing instead of opaque black.
use stamp_tool::parse_color;

#[test]
fn parse_color_reads_the_transparent_keyword_as_alpha_zero() {
    assert_eq!(parse_color("transparent"), vec![0, 0, 0, 0]);
    assert_eq!(parse_color("  Transparent "), vec![0, 0, 0, 0]);
    assert_eq!(parse_color("#ff0000"), vec![255, 0, 0, 255]);
}
