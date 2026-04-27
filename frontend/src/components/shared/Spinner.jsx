const SIZE_MAP = {
  3: "w-3 h-3",
  4: "w-4 h-4",
  5: "w-5 h-5",
  6: "w-6 h-6",
  8: "w-8 h-8",
};

export default function Spinner({ size = 6 }) {
  const sizeClass = SIZE_MAP[size] ?? "w-6 h-6";
  return (
    <div
      className={`${sizeClass} border-2 border-indigo-500 border-t-transparent rounded-full animate-spin`}
    />
  );
}
