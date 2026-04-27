const METHOD_COLORS = {
  GET:    "bg-blue-900 text-blue-300",
  POST:   "bg-green-900 text-green-300",
  PUT:    "bg-yellow-900 text-yellow-300",
  PATCH:  "bg-orange-900 text-orange-300",
  DELETE: "bg-red-900 text-red-300",
};

export default function Sidebar({ schema, selected, onSelect }) {
  if (!schema) return null;

  const byTag = {};
  for (const ep of schema.endpoints) {
    const tag = ep.tag || "default";
    if (!byTag[tag]) byTag[tag] = [];
    byTag[tag].push(ep);
  }

  return (
    <div className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="p-3 border-b border-gray-800">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Endpoints</p>
        <p className="text-sm text-white font-semibold truncate">{schema.title}</p>
        <p className="text-xs text-gray-500">{schema.version}</p>
      </div>
      {Object.entries(byTag).map(([tag, eps]) => (
        <div key={tag}>
          <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">{tag}</p>
          {eps.map((ep) => {
            const key = `${ep.method}:${ep.path}`;
            const isSelected = selected && selected.method === ep.method && selected.path === ep.path;
            return (
              <button
                key={key}
                onClick={() => onSelect(ep)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                  isSelected ? "bg-indigo-900/40 border-l-2 border-indigo-500" : "hover:bg-gray-800"
                }`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${METHOD_COLORS[ep.method] || "bg-gray-700 text-gray-300"}`}>
                  {ep.method}
                </span>
                <span className="truncate text-gray-300 font-mono text-xs">{ep.path}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
