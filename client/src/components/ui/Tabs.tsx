import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  value: string;
  select: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab, TabList and TabPanel must be used inside <Tabs>.');
  return context;
}

const safe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export interface TabsProps {
  /** Controlled: the open tab. Use with `onValueChange`. */
  value?: string;
  /** Uncontrolled: the tab open at first. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}

/**
 * Tabs for views of the same thing (Description, Specs, Fitment on a product page).
 *
 *   <Tabs defaultValue="specs">
 *     <TabList label="Product details">
 *       <Tab value="specs">Specs</Tab>
 *       <Tab value="fitment" count={12}>Fitment</Tab>
 *     </TabList>
 *     <TabPanel value="specs">...</TabPanel>
 *     <TabPanel value="fitment">...</TabPanel>
 *   </Tabs>
 */
export function Tabs({ value, defaultValue = '', onValueChange, className, children }: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const select = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ value: current, select, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  /** Names the set of tabs for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
}

/** The row of tabs. Arrow keys, Home and End move along it; the tab under focus opens. Scrolls sideways on a phone. */
export function TabList({ label, className, children }: TabListProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const at = tabs.findIndex((tab) => tab === document.activeElement);
    if (at < 0) return;
    let next = at;
    if (event.key === 'ArrowRight') next = (at + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (at - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('no-scrollbar flex gap-6 overflow-x-auto border-b border-line', className)}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  /** A real count shown after the label. */
  count?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Tab({ value, count, disabled = false, className, children }: TabProps) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${tabs.baseId}-tab-${safe(value)}`}
      aria-selected={selected}
      aria-controls={`${tabs.baseId}-panel-${safe(value)}`}
      // With no tab chosen yet, every tab stays reachable by keyboard.
      tabIndex={selected || tabs.value === '' ? 0 : -1}
      disabled={disabled}
      onClick={() => tabs.select(value)}
      className={cn(
        'focus-ring-inset -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-[3px] text-sm font-bold whitespace-nowrap',
        'transition-colors dur-quick disabled:cursor-not-allowed disabled:opacity-45',
        selected ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
        className,
      )}
    >
      {children}
      {count !== undefined && <span className="font-normal text-muted tnum">{count}</span>}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  /** Keep the panel in the page while hidden, so its state (a half-filled form) survives a tab change. */
  keepMounted?: boolean;
  className?: string;
  children: ReactNode;
}

export function TabPanel({ value, keepMounted = false, className, children }: TabPanelProps) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  if (!selected && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={`${tabs.baseId}-panel-${safe(value)}`}
      aria-labelledby={`${tabs.baseId}-tab-${safe(value)}`}
      hidden={!selected}
      tabIndex={0}
      className={cn('pt-4', className)}
    >
      {children}
    </div>
  );
}
