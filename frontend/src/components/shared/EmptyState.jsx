export default function EmptyState({ message = "No data yet." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M9 7a4 4 0 118 0 4 4 0 01-8 0z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
