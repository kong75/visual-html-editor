import React from 'react';
import { Select } from '@base-ui/react/select';

interface InspectorInputProps {
  label: string;
  property: string;
  value: string;
  placeholder?: string;
  swatch?: boolean;
  resolvedColor?: string;
  onChange: (property: string, value: string) => void;
  onCommit: (property: string, value: string) => void;
}

export function InspectorInput({
  label,
  property,
  value,
  placeholder,
  swatch = false,
  resolvedColor,
  onChange,
  onCommit
}: InspectorInputProps) {
  const pickerColor = /^#[0-9a-f]{6}/i.test(value.trim()) ? value.trim() : resolvedColor ?? '';
  const pickerValue = /^#[0-9a-f]{6}/i.test(pickerColor) ? pickerColor.slice(0, 7) : '#000000';
  return (
    <div className={`vhe-property${swatch ? ' vhe-property--swatch' : ''}`} data-style-property={property}>
      <span className="vhe-property__label">{label}</span>
      {swatch && (
        <span className="vhe-property__swatch" style={{ backgroundColor: value, backgroundImage: /transparent|rgba\([^)]*,\s*0\s*\)/i.test(value) ? undefined : 'none' }}>
          <input
            className="vhe-property__color-picker"
            type="color"
            value={pickerValue}
            aria-label={`Choose ${label}`}
            onChange={(event) => {
              onChange(property, event.target.value);
              onCommit(property, event.target.value);
            }}
          />
        </span>
      )}
      <input
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }}
        onChange={(event) => onChange(property, event.target.value)}
        onBlur={(event) => {
          if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) {
            onCommit(property, event.currentTarget.value);
          }
        }}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </div>
  );
}

interface InspectorSelectProps {
  label: string;
  property: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (property: string, value: string) => void;
  onCommit: (property: string, value: string) => void;
}

interface EditorSelectOption {
  value: string;
  label: string;
  description?: string;
  previewWidth?: number;
  previewHeight?: number;
}

interface EditorSelectProps {
  ariaLabel: string;
  menuAriaLabel: string;
  value: string;
  options: readonly EditorSelectOption[];
  triggerClassName: string;
  popupClassName?: string;
  renderTrigger: (selected: EditorSelectOption) => React.ReactNode;
  onValueChange: (value: string) => void;
}

export function EditorSelect({ ariaLabel, menuAriaLabel, value, options, triggerClassName, popupClassName = '', renderTrigger, onValueChange }: EditorSelectProps) {
  const resolvedOptions = value && !options.some((option) => option.value === value)
    ? [{ value, label: value }, ...options]
    : options;
  const selected = resolvedOptions.find((option) => option.value === value) ?? resolvedOptions[0];

  return (
    <Select.Root items={resolvedOptions} value={value} onValueChange={(nextValue) => { if (nextValue) onValueChange(nextValue); }}>
      <Select.Trigger className={triggerClassName} aria-label={ariaLabel}>
        {renderTrigger(selected)}
        <Select.Icon className="vhe-select__icon"><span className="vhe-select__chevron" aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="vhe-select__positioner" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className={`vhe-select__popup ${popupClassName}`}>
            <Select.List className="vhe-select__list" aria-label={menuAriaLabel}>
              {resolvedOptions.map((option) => (
                <Select.Item key={option.value} value={option.value} className={`vhe-select__item${option.previewWidth && option.previewHeight ? ' vhe-select__item--preview' : ''}`}>
                  <span className="vhe-select__indicator-slot" aria-hidden="true">
                    <Select.ItemIndicator className="vhe-select__indicator"><span /></Select.ItemIndicator>
                  </span>
                  {option.previewWidth && option.previewHeight && (
                    <span className="vhe-select__ratio" style={{ aspectRatio: `${option.previewWidth} / ${option.previewHeight}` }} aria-hidden="true" />
                  )}
                  <span className="vhe-select__item-copy">
                    <Select.ItemText>{option.label}</Select.ItemText>
                    {option.description && <small>{option.description}</small>}
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function InspectorSelect({ label, property, value, options, onChange, onCommit }: InspectorSelectProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  return (
    <div className="vhe-property vhe-property--menu" data-style-property={property}>
      <EditorSelect
        ariaLabel={`${label}: ${selectedLabel}`}
        menuAriaLabel={`${label} options`}
        value={value}
        options={options}
        triggerClassName="vhe-property__menu-trigger"
        onValueChange={(nextValue) => {
          onChange(property, nextValue);
          onCommit(property, nextValue);
        }}
        renderTrigger={(selected) => (
          <>
            <span className="vhe-property__label">{label}</span>
            <span className="vhe-property__menu-value">{selected.label}</span>
          </>
        )}
      />
    </div>
  );
}

interface InspectorDisclosureProps {
  label: string;
  property: string;
  value: string;
  placeholder?: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (property: string, value: string) => void;
  onCommit: (property: string, value: string) => void;
  children: React.ReactNode;
}

export function InspectorDisclosure({ label, property, value, placeholder, expanded, onToggle, onChange, onCommit, children }: InspectorDisclosureProps) {
  return (
    <div className={`vhe-disclosure${expanded ? ' vhe-disclosure--expanded' : ''}`} data-style-property={property}>
      <div className="vhe-disclosure__summary">
        <button type="button" className="vhe-disclosure__label" onClick={onToggle}>{label}</button>
        <input
          value={value}
          placeholder={placeholder}
          aria-label={`${label} shorthand`}
          onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }}
          onChange={(event) => onChange(property, event.target.value)}
          onBlur={(event) => {
            if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) {
              onCommit(property, event.currentTarget.value);
            }
          }}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        />
        <button type="button" className="vhe-disclosure__toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`} aria-expanded={expanded} onClick={onToggle}>
          <span className="vhe-disclosure__chevron" aria-hidden="true" />
        </button>
      </div>
      {expanded && <div className="vhe-disclosure__content">{children}</div>}
    </div>
  );
}
