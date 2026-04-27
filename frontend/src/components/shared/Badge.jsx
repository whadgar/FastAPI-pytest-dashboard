export default function Badge({ status }) {
  let cls = "px-2 py-0.5 rounded text-xs font-bold ";
  if (status >= 200 && status < 300) cls += "bg-green-900 text-green-300";
  else if (status >= 300 && status < 400) cls += "bg-blue-900 text-blue-300";
  else if (status >= 400 && status < 500) cls += "bg-yellow-900 text-yellow-300";
  else if (status >= 500) cls += "bg-red-900 text-red-300";
  else cls += "bg-gray-700 text-gray-300";
  return <span className={cls}>{status || "—"}</span>;
}
