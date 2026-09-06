import { Component, createSignal, For, Show } from 'solid-js';
import Input from './Input';

interface Site {
  id: string;
  name: string;
  url: string;
}

interface SiteViewerProps {
  sites: Site[];
  onSitesChange?: (sites: Site[]) => void;
}

const SiteViewer: Component<SiteViewerProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(0);
  const [editingTab, setEditingTab] = createSignal<number | null>(null);
  const [editName, setEditName] = createSignal('');
  const [editUrl, setEditUrl] = createSignal('');

  const addNewTab = () => {
    const newSite: Site = {
      id: `tab-${Date.now()}`,
      name: 'New Tab',
      url: '',
    };
    const newIndex = props.sites.length;
    props.onSitesChange?.([...props.sites, newSite]);
    setActiveTab(newIndex);
    // Set editing state immediately before props update
    setEditingTab(newIndex);
    setEditName('New Tab');
    setEditUrl('');
  };

  const removeTab = (index: number, e: MouseEvent) => {
    e.stopPropagation();
    const newSites = props.sites.filter((_, i) => i !== index);
    props.onSitesChange?.(newSites);
    if (activeTab() >= newSites.length) {
      setActiveTab(Math.max(0, newSites.length - 1));
    }
  };

  const startEditing = (index: number) => {
    setEditingTab(index);
    setEditName(props.sites[index]?.name || '');
    setEditUrl(props.sites[index]?.url || '');
  };

  const saveEdit = () => {
    const index = editingTab();
    if (index === null) return;

    const newSites = [...props.sites];
    newSites[index] = {
      ...newSites[index],
      name: editName().trim() || 'Untitled',
      url: editUrl().trim(),
    };
    props.onSitesChange?.(newSites);
    setEditingTab(null);
  };

  const cancelEdit = () => {
    setEditingTab(null);
  };

  return (
    <div class='border-t border-border bg-bg flex flex-col h-full text-xs'>
      {/* Tabs */}
      <div class='panel-tab-row overflow-x-auto'>
        <For each={props.sites}>
          {(site, index) => (
            <div
                class={`panel-tab flex items-center gap-2 font-medium border-b-2 transition-colors ${
                activeTab() === index()
                  ? 'border-accent'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}>
              <button
                onClick={() => setActiveTab(index())}
                class='flex-1 text-left'>
                {site.name}
              </button>
              <button
                onClick={(e) => removeTab(index(), e)}
                class='text-xs hover:text-fg transition-colors'
                title='Close tab'>
                ×
              </button>
            </div>
          )}
        </For>
        <button
          onClick={addNewTab}
          class='panel-tab font-medium text-fg-muted hover:text-fg transition-colors border-b-2 border-transparent'
          title='Add new tab'>
          +
        </button>
      </div>

      {/* Content - All tabs stay mounted, visibility toggled with CSS */}
      <div class='relative flex-1 overflow-hidden'>
        <For each={props.sites}>
          {(site, index) => (
            <>
              {/* Edit Form */}
              <div
                class='absolute inset-0 flex flex-col items-center justify-center p-8 bg-bg'
                style={{
                  display: editingTab() === index() ? 'flex' : 'none',
                }}>
                <div class='w-full max-w-md space-y-4'>
                  <div class='control-group'>
                    <label class='block text-xs text-fg-muted'>
                      Tab Name
                    </label>
                    <Input
                      type='text'
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      placeholder='Enter tab name...'
                      class='w-full'
                      autofocus={editingTab() === index()}
                    />
                  </div>
                  <div class='control-group'>
                    <label class='block text-xs text-fg-muted'>URL</label>
                    <Input
                      type='url'
                      value={editUrl()}
                      onInput={(e) => setEditUrl(e.currentTarget.value)}
                      placeholder='https://example.com'
                      class='w-full'
                    />
                  </div>
                  <div class='flex gap-2'>
                    <button onClick={saveEdit} class='btn-primary'>
                      Save
                    </button>
                    <button onClick={cancelEdit} class='btn-secondary'>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              {/* Empty state */}
              <Show when={!site.url && editingTab() !== index()}>
                <div
                  class='absolute inset-0 flex flex-col items-center justify-center p-8 gap-4 bg-bg'
                  style={{
                    display: activeTab() === index() ? 'flex' : 'none',
                  }}>
                  <div class='text-xs text-center text-fg-muted'>
                    No URL configured for this tab
                  </div>
                  <button
                    onClick={() => startEditing(index())}
                    class='panel-control btn-secondary'>
                    Configure Tab
                  </button>
                </div>
              </Show>

              {/* Iframe content */}
              <Show when={site.url}>
                <div
                  class='absolute inset-0'
                  style={{
                    display:
                      activeTab() === index() && editingTab() !== index()
                        ? 'block'
                        : 'none',
                  }}>
                  <iframe
                    src={site.url}
                    class='w-full h-full border-0'
                    title={site.name}
                    sandbox='allow-same-origin allow-scripts allow-popups allow-forms'
                  />
                  <button
                    onClick={() => startEditing(index())}
                    class='panel-control absolute top-2 right-2 bg-bg border border-border hover:bg-bg-subtle transition-colors'
                    title='Edit tab'>
                    Edit
                  </button>
                </div>
              </Show>
            </>
          )}
        </For>
      </div>
    </div>
  );
};

export default SiteViewer;
