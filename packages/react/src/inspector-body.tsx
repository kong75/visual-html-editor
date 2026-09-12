import React from 'react';
import type { ParsedNode, EditorProfile } from '@visual-html/core';
import { InspectorInput, InspectorSelect, InspectorDisclosure } from './inspector-controls.js';
import { attributeValue } from './source-node.js';

interface InspectorBodyProps {
  selectedNode: ParsedNode;
  profile: EditorProfile;
  revision: number;
  propertyDrafts: Record<string, string>;
  computedStyleValues: Record<string, string>;
  renderedStyleDifferences: Array<{ property: string; source: string; rendered: string }>;
  expandedBoxControl: string | null;
  setExpandedBoxControl: React.Dispatch<React.SetStateAction<string | null>>;
  updateStyleDraft: (property: string, value: string) => void;
  applyStyle: (property: string, value: string) => Promise<void>;
  applyAttribute: (name: string, value: string) => Promise<void>;
  onReplaceImage: () => void;
}

export function InspectorBody({ selectedNode, profile, revision, propertyDrafts, computedStyleValues, renderedStyleDifferences, expandedBoxControl, setExpandedBoxControl, updateStyleDraft, applyStyle, applyAttribute, onReplaceImage }: InspectorBodyProps) {
  const allowedCssProperties = profile.html.allowedCssProperties;
  const allowsStyle = (property: string) => allowedCssProperties.includes(property);
  const showFlexLayout = ['flex', 'inline-flex'].includes(propertyDrafts.display?.trim());
  const typographyProperties = ['font-family', 'font-size', 'font-weight', 'color', 'text-align', 'line-height', 'letter-spacing'];
  const boxProperties = ['background-color', 'opacity', 'padding', 'margin', 'border', 'border-radius'];

  return (
    <div className="vhe-inspector__body">
      {renderedStyleDifferences.length > 0 && (
        <section className="vhe-style-feedback" role="status" aria-label="Rendered style values">
          <strong>Rendered values</strong>
          <p>CSS rules and layout can change how your values appear.</p>
          {renderedStyleDifferences.map(({ property, source, rendered }) => (
            <p key={property}><strong>{property}</strong>: {rendered} on canvas (source: {source}).</p>
          ))}
        </section>
      )}
      {profile.capabilities.editStyles && typographyProperties.some(allowsStyle) && (
        <section className="vhe-inspector-section">
          <h3>Typography</h3>
          <div className="vhe-property-grid">
            {allowsStyle('font-family') && <InspectorInput label="Font" property="font-family" value={propertyDrafts['font-family'] ?? ''} placeholder="Arial, sans-serif" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('font-size') && <InspectorInput label="Size" property="font-size" value={propertyDrafts['font-size'] ?? ''} placeholder="16px" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('font-weight') && <InspectorInput label="Weight" property="font-weight" value={propertyDrafts['font-weight'] ?? ''} placeholder="400" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('color') && <InspectorInput label="Color" property="color" value={propertyDrafts.color ?? ''} placeholder="#000000" swatch resolvedColor={computedStyleValues.color} onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('text-align') && <InspectorSelect label="Align" property="text-align" value={propertyDrafts['text-align'] ?? 'start'} options={[{ value: 'start', label: 'start' }, { value: 'left', label: 'left' }, { value: 'center', label: 'center' }, { value: 'right', label: 'right' }, { value: 'justify', label: 'justify' }]} onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('line-height') && <InspectorInput label="Line" property="line-height" value={propertyDrafts['line-height'] ?? ''} placeholder="normal" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('letter-spacing') && <InspectorInput label="Tracking" property="letter-spacing" value={propertyDrafts['letter-spacing'] ?? ''} placeholder="normal" onChange={updateStyleDraft} onCommit={applyStyle} />}
          </div>
        </section>
      )}

      {profile.capabilities.editStyles && (allowsStyle('width') || allowsStyle('height')) && (
        <section className="vhe-inspector-section">
          <h3>Size</h3>
          <div className="vhe-property-grid">
            {allowsStyle('width') && <InspectorInput label="Width" property="width" value={propertyDrafts.width ?? ''} placeholder="auto" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('height') && <InspectorInput label="Height" property="height" value={propertyDrafts.height ?? ''} placeholder="auto" onChange={updateStyleDraft} onCommit={applyStyle} />}
          </div>
        </section>
      )}

      {profile.capabilities.editStyles && showFlexLayout && (
        <section className="vhe-inspector-section">
          <h3>Layout</h3>
          <div className="vhe-property-grid">
            {allowsStyle('gap') && <InspectorInput label="Gap" property="gap" value={propertyDrafts.gap ?? ''} placeholder="0px" onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('flex-direction') && <InspectorSelect label="Direction" property="flex-direction" value={propertyDrafts['flex-direction'] ?? 'row'} options={[{ value: 'row', label: 'row' }, { value: 'row-reverse', label: 'row reverse' }, { value: 'column', label: 'column' }, { value: 'column-reverse', label: 'column reverse' }]} onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('justify-content') && <InspectorSelect label="Justify" property="justify-content" value={propertyDrafts['justify-content'] ?? 'normal'} options={[{ value: 'flex-start', label: 'flex-start' }, { value: 'center', label: 'center' }, { value: 'flex-end', label: 'flex-end' }, { value: 'space-between', label: 'space-between' }, { value: 'space-around', label: 'space-around' }, { value: 'space-evenly', label: 'space-evenly' }]} onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('align-items') && <InspectorSelect label="Align" property="align-items" value={propertyDrafts['align-items'] ?? 'normal'} options={[{ value: 'stretch', label: 'stretch' }, { value: 'flex-start', label: 'flex-start' }, { value: 'center', label: 'center' }, { value: 'flex-end', label: 'flex-end' }, { value: 'baseline', label: 'baseline' }]} onChange={updateStyleDraft} onCommit={applyStyle} />}
          </div>
        </section>
      )}

      {profile.capabilities.editStyles && boxProperties.some(allowsStyle) && (
        <section className="vhe-inspector-section">
          <h3>Box</h3>
          <div className="vhe-property-grid">
            {allowsStyle('background-color') && <InspectorInput label="Fill" property="background-color" value={propertyDrafts['background-color'] ?? ''} placeholder="transparent" swatch resolvedColor={computedStyleValues['background-color']} onChange={updateStyleDraft} onCommit={applyStyle} />}
            {allowsStyle('opacity') && <InspectorInput label="Opacity" property="opacity" value={propertyDrafts.opacity ?? ''} placeholder="1" onChange={updateStyleDraft} onCommit={applyStyle} />}
          </div>

          {allowsStyle('padding') && (
            <InspectorDisclosure label="Padding" property="padding" value={propertyDrafts.padding ?? ''} placeholder="0px" expanded={expandedBoxControl === 'padding'} onToggle={() => setExpandedBoxControl((current) => current === 'padding' ? null : 'padding')} onChange={updateStyleDraft} onCommit={applyStyle}>
              <InspectorInput label="T" property="padding-top" value={propertyDrafts['padding-top'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="R" property="padding-right" value={propertyDrafts['padding-right'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="B" property="padding-bottom" value={propertyDrafts['padding-bottom'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="L" property="padding-left" value={propertyDrafts['padding-left'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
            </InspectorDisclosure>
          )}
          {allowsStyle('margin') && (
            <InspectorDisclosure label="Margin" property="margin" value={propertyDrafts.margin ?? ''} placeholder="0px" expanded={expandedBoxControl === 'margin'} onToggle={() => setExpandedBoxControl((current) => current === 'margin' ? null : 'margin')} onChange={updateStyleDraft} onCommit={applyStyle}>
              <InspectorInput label="T" property="margin-top" value={propertyDrafts['margin-top'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="R" property="margin-right" value={propertyDrafts['margin-right'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="B" property="margin-bottom" value={propertyDrafts['margin-bottom'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="L" property="margin-left" value={propertyDrafts['margin-left'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
            </InspectorDisclosure>
          )}
          {allowsStyle('border') && (
            <InspectorDisclosure label="Border" property="border" value={propertyDrafts.border || ''} placeholder={propertyDrafts['border-width'] || '0px'} expanded={expandedBoxControl === 'border'} onToggle={() => setExpandedBoxControl((current) => current === 'border' ? null : 'border')} onChange={updateStyleDraft} onCommit={applyStyle}>
              <InspectorInput label="Width" property="border-width" value={propertyDrafts['border-width'] ?? ''} placeholder="0px" onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorSelect label="Style" property="border-style" value={propertyDrafts['border-style'] ?? 'none'} options={[{ value: 'none', label: 'none' }, { value: 'solid', label: 'solid' }, { value: 'dashed', label: 'dashed' }, { value: 'dotted', label: 'dotted' }, { value: 'double', label: 'double' }]} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="Color" property="border-color" value={propertyDrafts['border-color'] ?? ''} placeholder="currentColor" swatch resolvedColor={computedStyleValues['border-color']} onChange={updateStyleDraft} onCommit={applyStyle} />
            </InspectorDisclosure>
          )}
          {allowsStyle('border-radius') && (
            <InspectorDisclosure label="Radius" property="border-radius" value={propertyDrafts['border-radius'] ?? ''} placeholder="0px" expanded={expandedBoxControl === 'radius'} onToggle={() => setExpandedBoxControl((current) => current === 'radius' ? null : 'radius')} onChange={updateStyleDraft} onCommit={applyStyle}>
              <InspectorInput label="TL" property="border-top-left-radius" value={propertyDrafts['border-top-left-radius'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="TR" property="border-top-right-radius" value={propertyDrafts['border-top-right-radius'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="BR" property="border-bottom-right-radius" value={propertyDrafts['border-bottom-right-radius'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
              <InspectorInput label="BL" property="border-bottom-left-radius" value={propertyDrafts['border-bottom-left-radius'] ?? ''} onChange={updateStyleDraft} onCommit={applyStyle} />
            </InspectorDisclosure>
          )}
        </section>
      )}

      {selectedNode.tagName === 'img' && (
        <section className="vhe-inspector-section">
          <h3>Image</h3>
          <div className="vhe-property-grid">
            <label className="vhe-property" data-attribute="src"><span className="vhe-property__label">Source</span><input aria-label="Source" defaultValue={attributeValue(selectedNode, 'src')} key={`${selectedNode.key}-src-${revision}`} onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }} onBlur={(event) => { if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) applyAttribute('src', event.currentTarget.value); }} /></label>
            <label className="vhe-property" data-attribute="alt"><span className="vhe-property__label">Alt</span><input aria-label="Alt text" defaultValue={attributeValue(selectedNode, 'alt')} key={`${selectedNode.key}-alt-${revision}`} onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }} onBlur={(event) => { if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) applyAttribute('alt', event.currentTarget.value); }} /></label>
          </div>
          <button type="button" className="vhe-button vhe-button--wide" onClick={() => onReplaceImage()}>Replace image</button>
        </section>
      )}

      <section className="vhe-inspector-section">
        <h3>Element</h3>
        <div className="vhe-property-grid">
          <label className="vhe-property" data-attribute="id"><span className="vhe-property__label">ID</span><input aria-label="ID" defaultValue={attributeValue(selectedNode, 'id')} key={`${selectedNode.key}-id-${revision}`} onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }} onBlur={(event) => { if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) applyAttribute('id', event.currentTarget.value); }} /></label>
          <label className="vhe-property" data-attribute="class"><span className="vhe-property__label">Class</span><input aria-label="Classes" defaultValue={attributeValue(selectedNode, 'class')} key={`${selectedNode.key}-class-${revision}`} onFocus={(event) => { event.currentTarget.dataset.initialValue = event.currentTarget.value; }} onBlur={(event) => { if (event.currentTarget.value !== event.currentTarget.dataset.initialValue) applyAttribute('class', event.currentTarget.value); }} /></label>
        </div>
      </section>
    </div>
  );
}
