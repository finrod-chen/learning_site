import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input, type InputProps } from '@/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack } from '@/components/ui/progress'
import { SegmentedControl as SegmentedRoot, SegmentedControlItem } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/* ---------- segmented control with a value / onValueChange interface ---------- */
export interface SegmentOption {
  value: string
  label: ReactNode
}
export function Segmented({ options, value, onValueChange, label, className }: { options: SegmentOption[]; value: string; onValueChange: (v: string) => void; label: string; className?: string }) {
  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <SegmentedRoot role="radiogroup" aria-label={label}>
        {options.map(o => (
          <SegmentedControlItem key={o.value} role="radio" aria-checked={o.value === value} data-checked={o.value === value ? '' : undefined} onClick={() => onValueChange(o.value)}>
            {o.label}
          </SegmentedControlItem>
        ))}
      </SegmentedRoot>
    </div>
  )
}

/* ---------- labelled form controls ---------- */
export function TextField({ label, error, className, ...props }: { label: string; error?: string } & InputProps) {
  return (
    <Field className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Input aria-invalid={error ? true : undefined} {...props} />
      {error && <p role="alert" className="text-destructive-foreground text-sm">{error}</p>}
    </Field>
  )
}

export function LabeledSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={v => onCheckedChange(v)} />
      <span>{label}</span>
    </label>
  )
}

/* ---------- progress with a text label ---------- */
export function Prog({ value, max = 100, label, showValue, className }: { value: number; max?: number; label: string; showValue?: boolean; className?: string }) {
  return (
    <Progress value={value} max={max} className={className}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <ProgressLabel>{label}</ProgressLabel>
        {showValue && <span className="text-muted-foreground tabular-nums">{max ? Math.round((value / max) * 100) : 0}%</span>}
      </div>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  )
}

/* ---------- loading placeholder ---------- */
export function Loading({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/* ---------- action menu (a button that opens a list of actions) ---------- */
export interface ActionItem {
  label: string
  onSelect?: () => void
  disabled?: boolean
  icon?: ReactNode
  destructive?: boolean
  separatorBefore?: boolean
}
function ActionItems({ items }: { items: ActionItem[] }) {
  return (
    <>
      {items.map(it => (
        <span key={it.label} className="contents">
          {it.separatorBefore && <MenuSeparator />}
          <MenuItem variant={it.destructive ? 'destructive' : 'default'} disabled={it.disabled} onClick={() => it.onSelect?.()}>
            {it.icon}
            {it.label}
          </MenuItem>
        </span>
      ))}
    </>
  )
}
export function ActionMenu({ label, items, icon, size = 'sm', variant = 'outline', ariaLabel }: { label: ReactNode; items: ActionItem[]; icon?: ReactNode; size?: ButtonProps['size']; variant?: ButtonProps['variant']; ariaLabel?: string }) {
  return (
    <Menu>
      <MenuTrigger render={<Button variant={variant} size={size} aria-label={ariaLabel} />}>
        {icon}
        {label}
        <ChevronDown aria-hidden="true" className="opacity-60" />
      </MenuTrigger>
      <MenuPopup align="end">
        <ActionItems items={items} />
      </MenuPopup>
    </Menu>
  )
}

/* ---------- split button: main action plus a menu of alternatives ---------- */
export function SplitButton({ label, onClick, actions }: { label: string; onClick: () => void; actions: ActionItem[] }) {
  return (
    <div className="inline-flex">
      <Button onClick={onClick} className="rounded-e-none">{label}</Button>
      <Menu>
        <MenuTrigger render={<Button size="icon" aria-label="更多儲存方式" className="rounded-s-none border-s-primary-foreground/25" />}>
          <ChevronDown aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end">
          <ActionItems items={actions} />
        </MenuPopup>
      </Menu>
    </div>
  )
}
