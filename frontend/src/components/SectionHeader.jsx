export default function SectionHeader({ icon, title, description, accent = 'blue' }) {
  const accents = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
  );
}