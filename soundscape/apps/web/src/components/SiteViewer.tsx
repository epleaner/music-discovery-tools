import { Component, createSignal, For, Show } from 'solid-js';

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
    props.onSitesChange?.([...props.sites, newSite]);
    setActiveTab(props.sites.length);
    startEditing(props.sites.length);
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
    setEditName(props.sites[index].name);
    setEditUrl(props.sites[index].url);
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
    <div class='border-t border-border bg-bg flex flex-col h-full'>
      {/* Tabs */}
      <div class='flex border-b border-border overflow-x-auto flex-shrink-0'>
        <For each={props.sites}>
          {(site, index) => (
            <div
              class={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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
          class='px-4 py-2 text-sm font-medium text-fg-muted hover:text-fg transition-colors border-b-2 border-transparent'
          title='Add new tab'>
          +
        </button>
      </div>

      {/* Content */}
      <div class='relative flex-1 overflow-hidden'>
        <For each={props.sites}>
          {(site, index) => (
            <Show when={activeTab() === index()}>
              <Show
                when={editingTab() === index()}
                fallback={
                  <Show
                    when={site.url}
                    fallback={
                      <div class='flex flex-col items-center justify-center h-full p-8 gap-4'>
                        <div class='text-xs text-center text-fg-muted'>
                          No URL configured for this tab
                        </div>
                        <button
                          onClick={() => startEditing(index())}
                          class='btn-secondary'>
                          Configure Tab
                        </button>
                      </div>
                    }>
                    <div class='relative h-full'>
                      <iframe
                        src={site.url}
                        class='w-full h-full border-0'
                        title={site.name}
                        sandbox='allow-same-origin allow-scripts allow-popups allow-forms'
                      />
                      <button
                        onClick={() => startEditing(index())}
                        class='absolute top-2 right-2 px-2 py-1 text-xs bg-bg border border-border hover:bg-bg-subtle transition-colors'
                        title='Edit tab'>
                        Edit
                      </button>
                    </div>
                  </Show>
                }>
                {/* Edit Form */}
                <div class='flex flex-col items-center justify-center h-full p-8'>
                  <div class='w-full max-w-md space-y-4'>
                    <div>
                      <label class='block mb-1 text-xs text-fg-muted'>
                        Tab Name
                      </label>
                      <input
                        type='text'
                        value={editName()}
                        onInput={(e) => setEditName(e.currentTarget.value)}
                        placeholder='Enter tab name...'
                        class='w-full input'
                      />
                    </div>
                    <div>
                      <label class='block mb-1 text-xs text-fg-muted'>
                        URL
                      </label>
                      <input
                        type='url'
                        value={editUrl()}
                        onInput={(e) => setEditUrl(e.currentTarget.value)}
                        placeholder='https://example.com'
                        class='w-full input'
                      />
                    </div>
                    <div class='flex gap-2'>
                      <button onClick={saveEdit} class='flex-1 btn-primary'>
                        Save
                      </button>
                      <button onClick={cancelEdit} class='flex-1 btn-secondary'>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};

export default SiteViewer;
