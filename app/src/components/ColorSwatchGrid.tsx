interface Props {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorSwatchGrid({ colors, value, onChange, label = "Color" }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 py-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={[
              "w-7 h-7 rounded-full border-2 border-transparent transition-all",
              value === color
                ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-800"
                : "hover:scale-105",
            ].join(" ")}
            style={{ backgroundColor: color }}
            aria-label={`Color ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
