import { useToastStore } from '../store/useToastStore';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium transform transition-all animate-fade-up-scale cursor-pointer flex items-center justify-between gap-3 min-w-[200px]
            ${
              toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'success' ? 'bg-green-500 text-white' :
              'bg-gray-800 text-white dark:bg-white dark:text-gray-900'
            }
          `}
          onClick={() => removeToast(toast.id)}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                removeToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
