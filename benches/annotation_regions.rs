// Native rectangle-only microbenchmark. The Node harness uses the broader
// mixed rectangle/arrow/pin/text fixture; do not compare their absolute times.
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use stamp_tool::{AnnotationRegionPrototype, ImageHorseTool};
use std::hint::black_box;

fn regions(c: &mut Criterion) {
    let mut group = c.benchmark_group("annotation_regions");
    group.sample_size(10);
    for count in [10, 100, 500] {
        let mut tool = ImageHorseTool::new(1200, 800);
        tool.load_image(&vec![255; 1200 * 800 * 4]);
        for i in 0..count {
            let x = (20 + (i * 137) % 1020) as f64;
            let y = (20 + (i * 83) % 700) as f64;
            tool.restore_shape_annotation(
                0,
                x,
                y,
                x + 100.0,
                y + 50.0,
                220,
                50,
                50,
                3.0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                8,
                0,
            );
        }
        let mut region = AnnotationRegionPrototype::new(&mut tool);
        group.bench_with_input(BenchmarkId::new("full", count), &count, |b, _| {
            b.iter(|| {
                tool.recomposite();
                black_box(tool.data_ptr());
            });
        });
        group.bench_with_input(BenchmarkId::new("dirty", count), &count, |b, _| {
            b.iter(|| {
                black_box(region.render(&mut tool, 16, 16, 144, 74));
                black_box(tool.data_ptr());
            });
        });
    }
    group.finish();
}

criterion_group!(benches, regions);
criterion_main!(benches);
