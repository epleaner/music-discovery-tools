import { Component, createSignal, For, Show } from 'solid-js';
import Button from './Button';
import ControlGroup from './ControlGroup';
import EmptyState from './EmptyState';
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
              <Button
                onClick={() => setActiveTab(index())}
                class="flex-1 text-left"
              >
                {site.name}
              </Button>
              <Button
                onClick={(e: MouseEvent) => removeTab(index(), e)}
                variant="icon"
                class="hover:text-fg transition-colors"
                title="Close tab"
                aria-label={`Close ${site.name}`}
              >
                ×
              </Button>
            </div>
          )}
        </For>
        <Button
          onClick={addNewTab}
          variant="tab"
          class="font-medium text-fg-muted hover:text-fg transition-colors border-b-2 border-transparent"
          title="Add new tab"
          aria-label="Add new tab"
        >
          +
        </Button>
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
                  <ControlGroup>
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
                  </ControlGroup>
                  <ControlGroup>
                    <label class='block text-xs text-fg-muted'>URL</label>
                    <Input
                      type='url'
                      value={editUrl()}
                      onInput={(e) => setEditUrl(e.currentTarget.value)}
                      placeholder='https://example.com'
                      class='w-full'
                    />
                  </ControlGroup>
                  <div class='flex gap-2'>
                    <Button onClick={saveEdit} variant='primary'>
                      Save
                    </Button>
                    <Button onClick={cancelEdit} variant='secondary'>
                      Cancel
                    </Button>
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
                  <EmptyState>No URL configured for this tab</EmptyState>
                  <Button
                    onClick={() => startEditing(index())}
                    variant="secondary"
                    class="px-2"
                  >
                    Configure Tab
                  </Button>
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
                  <Button
                    onClick={() => startEditing(index())}
                    variant="secondary"
                    class="px-2.5 absolute top-2 right-2 bg-bg border border-border hover:bg-bg-subtle transition-colors"
                    title="Edit tab"
                  >
                    Edit
                  </Button>
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
