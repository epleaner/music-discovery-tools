import { Component, createSignal, For, Show } from 'solid-js';
import Button from './Button';
import ControlGroup from './ControlGroup';
import EmptyState from './EmptyState';
import Input from './Input';
import PanelTab from './PanelTab';
import ExternalLink from './ExternalLink';

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
    setActiveTab((current) =>
      Math.max(
        0,
        Math.min(current > index ? current - 1 : current, newSites.length - 1)
      )
    );
    const editing = editingTab();
    if (editing === index) setEditingTab(null);
    else if (editing !== null && editing > index) setEditingTab(editing - 1);
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
    <section class="workspace-panel panel-scroll" aria-label="Sites">
      <div class="workspace-tabs flex-wrap">
        <For each={props.sites}>
          {(site, index) => (
            <div class="flex min-w-0 items-center">
              <PanelTab
                active={activeTab() === index()}
                underline
                onClick={() => setActiveTab(index())}
                aria-pressed={activeTab() === index()}
                class="min-w-0 whitespace-normal break-words"
              >
                {site.name}
              </PanelTab>
              <Button
                onClick={(e: MouseEvent) => removeTab(index(), e)}
                variant="icon"
                title={`Close ${site.name}`}
                aria-label={`Close ${site.name}`}
              >
                ×
              </Button>
            </div>
          )}
        </For>
        <Button
          onClick={addNewTab}
          variant="icon"
          title="Add site"
          aria-label="Add site"
        >
          +
        </Button>
      </div>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <For each={props.sites}>
          {(site, index) => (
            <div
              class="min-h-0 min-w-0 flex-1 flex-col"
              classList={{
                flex: activeTab() === index(),
                hidden: activeTab() !== index(),
              }}
            >
              <Show when={editingTab() === index()}>
                <form
                  class="form-stack section-content"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveEdit();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') cancelEdit();
                  }}
                >
                  <ControlGroup>
                    <label class="field-label" for={`site-name-${site.id}`}>
                      Site name
                    </label>
                    <Input
                      id={`site-name-${site.id}`}
                      type="text"
                      value={editName()}
                      onInput={(event) =>
                        setEditName(event.currentTarget.value)
                      }
                      class="w-full min-w-0"
                      autofocus
                    />
                  </ControlGroup>
                  <ControlGroup>
                    <label class="field-label" for={`site-url-${site.id}`}>
                      URL
                    </label>
                    <Input
                      id={`site-url-${site.id}`}
                      type="url"
                      value={editUrl()}
                      onInput={(event) => setEditUrl(event.currentTarget.value)}
                      placeholder="https://example.com"
                      class="w-full min-w-0"
                    />
                  </ControlGroup>
                  <div class="form-actions">
                    <Button type="submit" variant="primary">
                      Save
                    </Button>
                    <Button
                      type="button"
                      onClick={cancelEdit}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Show>
              <Show when={!site.url && editingTab() !== index()}>
                <div class="section-content form-stack">
                  <EmptyState>No URL configured</EmptyState>
                  <div class="form-actions">
                    <Button
                      onClick={() => startEditing(index())}
                      variant="secondary"
                    >
                      Configure site
                    </Button>
                  </div>
                </div>
              </Show>
              <Show when={site.url}>
                <div
                  class="min-h-0 flex-1 flex-col"
                  classList={{
                    flex: editingTab() !== index(),
                    hidden: editingTab() === index(),
                  }}
                >
                  <div class="section-header">
                    <ExternalLink
                      href={site.url}
                      class="meta-text min-w-0 break-all"
                    >
                      {site.url}
                    </ExternalLink>
                    <Button
                      onClick={() => startEditing(index())}
                      variant="secondary"
                      aria-label={`Edit ${site.name}`}
                    >
                      Edit
                    </Button>
                  </div>
                  <iframe
                    src={site.url}
                    class="media-frame min-h-96 flex-1 lg:min-h-0"
                    title={site.name}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                </div>
              </Show>
            </div>
          )}
        </For>
        <Show when={props.sites.length === 0}>
          <EmptyState class="section-content">No sites</EmptyState>
        </Show>
      </div>
    </section>
  );
};

export default SiteViewer;
