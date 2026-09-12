import { useCallback, useEffect, useState } from 'react';
import type { EditorController, NodeKey } from '@visual-html/core';
import type { useCanvasSelection } from '../canvas/use-selection.js';
import { queryRuntimeElement } from '../canvas/selection.js';
import { inspectorStyleProperties, normalizeInspectorStyleValue } from './values.js';

interface InspectorPropertiesOptions {
  controller: EditorController;
  revision: number;
  selectedKey: NodeKey | null;
  selection: ReturnType<typeof useCanvasSelection>['runtime'];
  setNotice: (message: string | null) => void;
  run: (operation: Promise<{ ok: boolean; message?: string }>) => Promise<boolean>;
}

export function useInspectorProperties({ controller, revision, selectedKey, selection, setNotice, run }: InspectorPropertiesOptions) {
  const { iframeRef, selectedKeyRef } = selection;
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, string>>({});
  const [computedStyleValues, setComputedStyleValues] = useState<Record<string, string>>({});
  const [renderedStyleDifferences, setRenderedStyleDifferences] = useState<Array<{ property: string; source: string; rendered: string }>>([]);
  const [expandedBoxControl, setExpandedBoxControl] = useState<string | null>(null);
  const refreshPropertyDrafts = useCallback(() => {
    const element = queryRuntimeElement(iframeRef.current, selectedKeyRef.current);
    if (!element) {
      setPropertyDrafts({});
      setComputedStyleValues({});
      setRenderedStyleDifferences([]);
      return;
    }
    const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
    const values: Record<string, string> = {};
    const computedValues: Record<string, string> = {};
    const differences: Array<{ property: string; source: string; rendered: string }> = [];
    for (const property of inspectorStyleProperties) {
      const authored = element.style.getPropertyValue(property);
      const effective = computed?.getPropertyValue(property) || '';
      const value = authored || effective;
      values[property] = normalizeInspectorStyleValue(property, value);
      const rendered = normalizeInspectorStyleValue(property, effective);
      computedValues[property] = rendered;
      if (authored && rendered && values[property] !== rendered) {
        differences.push({ property, source: values[property]!, rendered });
      }
    }
    setPropertyDrafts(values);
    setComputedStyleValues(computedValues);
    setRenderedStyleDifferences(differences);
  }, []);

  useEffect(() => {
    refreshPropertyDrafts();
  }, [refreshPropertyDrafts, selectedKey, revision]);

  useEffect(() => { setPropertyDrafts({}); setExpandedBoxControl(null); }, [controller]);
  const applyStyle = useCallback(async (property: string, value: string) => {
    if (!selectedKey) return;
    const nextValue = value.trim();
    if (nextValue && !CSS.supports(property, nextValue.replace(/\s*!important\s*$/i, ''))) {
      setNotice(`“${nextValue}” is not valid for ${property}. The previous value is unchanged.`);
      refreshPropertyDrafts();
      return;
    }
    await run(controller.dispatch({ type: 'setStyle', nodeKey: selectedKey, property, value: nextValue || null }));
  }, [controller, refreshPropertyDrafts, run, selectedKey]);

  const applyAttribute = useCallback(async (name: string, value: string) => {
    if (!selectedKey) return;
    await run(controller.dispatch(name === 'src' && controller.getNode(selectedKey)?.tagName === 'img'
      ? { type: 'replaceImage', nodeKey: selectedKey, src: value.trim() || null }
      : { type: 'setAttribute', nodeKey: selectedKey, name, value: value.trim() || null }));
  }, [controller, run, selectedKey]);

  const updateStyleDraft = (property: string, value: string) => {
    setPropertyDrafts((current) => ({ ...current, [property]: value }));
  };

  return { propertyDrafts, computedStyleValues, renderedStyleDifferences, expandedBoxControl, setExpandedBoxControl, refreshPropertyDrafts, updateStyleDraft, applyStyle, applyAttribute };
}
