import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type SearchableCari = {
  id: string | number;
  name: string;
  account_code?: string | null;
  source_cari_no?: string | null;
  phone?: string | null;
  city?: string | null;
};

export function DukkanCariSearchPicker({ parties, value, onChange }: {
  parties: SearchableCari[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = parties.find(item => String(item.id) === value);

  const matches = useMemo(() => {
    const words = query.trim().toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean);
    return parties.filter(item => {
      const haystack = [item.name, item.account_code, item.source_cari_no, item.phone, item.city]
        .filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
      return words.every(word => haystack.includes(word));
    }).slice(0, 12);
  }, [parties, query]);

  const choose = (item: SearchableCari) => {
    onChange(String(item.id));
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <div className="relative">
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        role="combobox"
        autoComplete="off"
        aria-label="Cari hesap ara"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches.length ? listId + "-option-" + active : undefined}
        placeholder="Cari adı, kodu veya telefon ara..."
        className="w-full min-w-0 rounded-xl border border-[#dbe5f0] bg-white py-3 pl-10 pr-10 text-sm text-[#142b4e] outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        value={open ? query : (selected?.name || "")}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onChange={event => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange("");
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" && open) {
            event.preventDefault(); setActive(index => Math.min(matches.length - 1, index + 1));
          } else if (event.key === "ArrowUp" && open) {
            event.preventDefault(); setActive(index => Math.max(0, index - 1));
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); if (matches[active]) choose(matches[active]);
          } else if (event.key === "Escape") {
            event.preventDefault(); setOpen(false);
          }
        }}
      />
      {value && <button type="button" aria-label="Cari seçimini temizle" title="Cari seçimini temizle"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
        onClick={() => { onChange(""); setQuery(""); setActive(0); setOpen(true); }}>
        <X size={16} />
      </button>}
    </div>
    {open && <div id={listId} role="listbox" aria-label="Cari hesaplar"
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#dbe5f0] bg-white p-1.5 shadow-xl">
      {matches.length ? matches.map((item, index) => <button
        key={String(item.id)}
        id={listId + "-option-" + index}
        type="button"
        role="option"
        aria-selected={String(item.id) === value}
        onMouseDown={event => event.preventDefault()}
        onClick={() => choose(item)}
        className={"block w-full rounded-lg px-3 py-2 text-left transition " +
          (index === active ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-50")}>
        <span className="block truncate text-sm font-semibold">{item.name}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {[item.account_code && "Kod: " + item.account_code,
            item.source_cari_no && "No: " + item.source_cari_no, item.phone]
            .filter(Boolean).join(" · ") || "Cari hesap"}
        </span>
      </button>) : <p className="px-3 py-3 text-sm text-slate-500">Eşleşen cari hesap bulunamadı.</p>}
      {matches.length === 12 && <p className="px-3 py-1 text-xs text-slate-500">Daha fazla sonuç için aramayı daraltın.</p>}
    </div>}
  </div>;
}
