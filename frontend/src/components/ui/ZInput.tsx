import { InputHTMLAttributes, forwardRef } from 'react';

export interface ZInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/** ZRH Input — 统一输入框 */
export const ZInput = forwardRef<HTMLInputElement, ZInputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs text-zrh-text-dim sm:text-sm">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-zrh-surface px-3.5 py-2.5 text-sm text-zrh-text outline-none transition-shadow placeholder:text-zrh-text-dim/60 focus:shadow-[0_0_0_2px_var(--zrh-bg),0_0_0_4px_var(--zrh-accent)] ${
            error ? 'border-zrh-err/60' : 'border-zrh-border'
          } ${className}`}
          {...rest}
        />
        {error && <p className="text-xs text-zrh-err">{error}</p>}
      </div>
    );
  },
);
ZInput.displayName = 'ZInput';
