/**
 * The UI kit. Import from here: `import { Button, Field, Input, toast } from '@/components/ui'`.
 * Props and usage for every component: client/DESIGN.md and the /styleguide page.
 */

// actions
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { CopyButton, type CopyButtonProps } from './CopyButton';

// forms
export { Field, useFieldControl, type FieldProps } from './Field';
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectOption, type SelectProps } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { RadioGroup, type RadioGroupProps, type RadioOption } from './RadioGroup';
export { Switch, type SwitchProps } from './Switch';
export { Segmented, type SegmentedOption, type SegmentedProps } from './Segmented';
export { Slider, type SliderProps } from './Slider';

// status and labels
export { Badge, type BadgeProps, type BadgeTone, type BadgeToneName, type BadgeVariant } from './Badge';
export { Chip, type ChipProps } from './Chip';
export { Callout, type CalloutProps, type CalloutTone } from './Callout';
export { Countdown, type CountdownProps } from './Countdown';
export { Kbd } from './Kbd';

// structure
export { Card, CardBody, CardFooter, CardHeader, type CardProps, type CardSectionProps } from './Card';
export { Divider, type DividerProps } from './Divider';
export { Tabs, TabList, Tab, TabPanel, type TabListProps, type TabPanelProps, type TabProps, type TabsProps } from './Tabs';
export { Accordion, AccordionItem, type AccordionItemProps, type AccordionProps } from './Accordion';
export { Table, type TableColumn, type TableProps } from './Table';
export { CountUp } from './CountUp';
export { Stat, type StatDelta, type StatProps } from './Stat';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Skeleton, SkeletonText, type SkeletonTextProps } from './Skeleton';

// navigation
export { Breadcrumbs, type BreadcrumbsProps, type Crumb } from './Breadcrumbs';
export { Pagination, type PaginationProps } from './Pagination';
export { Stepper, type Step, type StepperProps } from './Stepper';

// overlays
export { Modal, type ModalProps } from './Modal';
export { Drawer, type DrawerProps } from './Drawer';
export { Popover, type PopoverProps } from './Popover';
export { Tooltip, type TooltipProps } from './Tooltip';
export { Toaster } from './Toast';
export { toast, useToastStore, type ToastItem, type ToastOptions, type ToastTone } from './toastStore';
export { Portal } from './Portal';

// accessibility helpers
export { VisuallyHidden, type VisuallyHiddenProps } from './VisuallyHidden';
export {
  getFocusable,
  prefersReducedMotion,
  useEscapeKey,
  useFloatingPosition,
  useFocusTrap,
  useOutsidePress,
  usePresence,
  useScrollLock,
  type Placement,
} from './a11y';
