interface Tab {
  id: string;
  label: string;
}

interface TabGroupProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function TabGroup({ tabs, active, onChange }: TabGroupProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all",
            active === tab.id
              ? "bg-accent text-text-primary shadow-md"
              : "text-text-muted hover:text-text-primary hover:bg-bg-elevated",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
