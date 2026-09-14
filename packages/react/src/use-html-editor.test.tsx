/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorController, emailProfile, webProfile } from '@visual-html/core';
import { useHtmlEditor, type UseHtmlEditorOptions } from './use-html-editor';

const initialHtml = '<!doctype html><html><body><h1>Initial</h1></body></html>';

function options(overrides: Partial<UseHtmlEditorOptions> = {}): UseHtmlEditorOptions {
  return { value: initialHtml, profile: webProfile, ...overrides };
}

describe('useHtmlEditor controlled lifecycle', () => {
  it('creates one controller and publishes initial state', async () => {
    const onReady = vi.fn();
    const onValidationChange = vi.fn();
    const onDirtyChange = vi.fn();
    const { result } = renderHook((props: UseHtmlEditorOptions) => useHtmlEditor(props), {
      initialProps: options({ onReady, onValidationChange, onDirtyChange })
    });

    expect(result.current).toMatchObject({ controller: null, status: 'loading', error: null });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith(result.current.controller);
    expect(onValidationChange).toHaveBeenLastCalledWith([]);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps the controller stable across profile and clean external value updates', async () => {
    const onChange = vi.fn();
    const onExternalUpdateResult = vi.fn();
    const { result, rerender } = renderHook((props: UseHtmlEditorOptions) => useHtmlEditor(props), {
      initialProps: options({ onChange, onExternalUpdateResult })
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const controller = result.current.controller!;

    rerender(options({
      value: '<p>External</p>',
      profile: emailProfile,
      onChange,
      onExternalUpdateResult
    }));

    await waitFor(() => expect(onExternalUpdateResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true, replaced: true })));
    expect(result.current.controller).toBe(controller);
    expect(controller.getSnapshot().profile).toBe(emailProfile);
    expect(controller.getSnapshot().html).toBe('<p>External</p>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the latest callbacks for local transactions and unsubscribes on unmount', async () => {
    const firstChange = vi.fn();
    const latestChange = vi.fn();
    const { result, rerender, unmount } = renderHook((props: UseHtmlEditorOptions) => useHtmlEditor(props), {
      initialProps: options({ onChange: firstChange })
    });
    await waitFor(() => expect(result.current.controller).not.toBeNull());
    const controller = result.current.controller!;
    rerender(options({ onChange: latestChange }));
    const heading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;

    await act(async () => {
      await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Local' });
    });
    expect(firstChange).not.toHaveBeenCalled();
    expect(latestChange).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('Local'), revision: 1 }));

    unmount();
    await controller.undo();
    expect(latestChange).toHaveBeenCalledOnce();
  });

  it('flushes asynchronous change handlers in transaction order', async () => {
    let releaseFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const order: string[] = [];
    const onChange = vi.fn(async (change: import('./use-html-editor').HtmlEditorChange) => {
      order.push(`start-${change.revision}`);
      if (change.revision === 1) await firstPending;
      order.push(`end-${change.revision}`);
    });
    const { result } = renderHook(() => useHtmlEditor(options({ onChange })));
    await waitFor(() => expect(result.current.controller).not.toBeNull());
    const controller = result.current.controller!;
    const heading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;

    await act(async () => {
      await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'First' });
      const nextHeading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;
      await controller.dispatch({ type: 'setText', nodeKey: nextHeading.key, text: 'Second' });
    });
    await waitFor(() => expect(order).toEqual(['start-1']));

    let flushed = false;
    const flush = result.current.flushChanges().then(() => { flushed = true; });
    await Promise.resolve();
    expect(flushed).toBe(false);
    releaseFirst();
    await flush;
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('reports an earlier persistence failure at the next flush boundary', async () => {
    const failure = new Error('Draft storage failed');
    const onError = vi.fn();
    const onChange = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useHtmlEditor(options({ onChange, onError })));
    await waitFor(() => expect(result.current.controller).not.toBeNull());
    const controller = result.current.controller!;
    const heading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;

    await act(async () => {
      await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'First' });
      const nextHeading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;
      await controller.dispatch({ type: 'setText', nodeKey: nextHeading.key, text: 'Second' });
    });
    await expect(result.current.flushChanges()).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    await expect(result.current.flushChanges()).resolves.toBeUndefined();
  });

  it('reports a recorded user import while continuing to suppress external replacements', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useHtmlEditor(options({ onChange })));
    await waitFor(() => expect(result.current.controller).not.toBeNull());

    await act(async () => {
      await result.current.controller!.replaceSource('<!doctype html><html><body><h1>Imported</h1></body></html>', {
        recordHistory: true,
        createCheckpoint: false,
        description: 'Import document.html'
      });
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Imported'),
      transaction: expect.objectContaining({ kind: 'source-replacement', description: 'Import document.html' })
    }));
  });

  it('reports dirty external-update rejection without replacing local work', async () => {
    const onExternalUpdateResult = vi.fn();
    const { result, rerender } = renderHook((props: UseHtmlEditorOptions) => useHtmlEditor(props), {
      initialProps: options({ externalUpdate: 'reject-when-dirty', onExternalUpdateResult })
    });
    await waitFor(() => expect(result.current.controller).not.toBeNull());
    const controller = result.current.controller!;
    const heading = controller.getSnapshot().nodes.find((node) => node.tagName === 'h1')!;
    await act(async () => {
      await controller.dispatch({ type: 'setText', nodeKey: heading.key, text: 'Unsaved' });
    });

    rerender(options({
      value: '<p>Rejected external</p>',
      externalUpdate: 'reject-when-dirty',
      onExternalUpdateResult
    }));
    await waitFor(() => expect(onExternalUpdateResult).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 'dirty-source-replacement' })));
    expect(controller.getSnapshot().html).toContain('Unsaved');
  });

  it('surfaces controller creation failures through state and onError', async () => {
    const failure = new Error('Creation failed');
    const onError = vi.fn();
    const create = vi.spyOn(EditorController, 'create').mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useHtmlEditor(options({ onError })));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    create.mockRestore();
  });

  it('normalizes non-Error creation failures and reports external update errors', async () => {
    const creationError = vi.fn();
    const create = vi.spyOn(EditorController, 'create').mockRejectedValueOnce('no controller');
    const failed = renderHook(() => useHtmlEditor(options({ onError: creationError })));
    await waitFor(() => expect(failed.result.current.status).toBe('error'));
    expect(creationError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unable to create the HTML editor.' }));
    failed.unmount();
    create.mockRestore();

    const updateError = vi.fn();
    const { result, rerender } = renderHook((props: UseHtmlEditorOptions) => useHtmlEditor(props), {
      initialProps: options({ onError: updateError })
    });
    await waitFor(() => expect(result.current.controller).not.toBeNull());
    vi.spyOn(result.current.controller!, 'replaceSource').mockRejectedValueOnce('cannot replace');
    rerender(options({ value: '<p>New</p>', onError: updateError }));
    await waitFor(() => expect(updateError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unable to apply external HTML.' })));
  });
});
