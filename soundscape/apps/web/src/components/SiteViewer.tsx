import { Component, createSignal, Show } from 'solid-js';

export interface Site {
  id: string;
  name: string;
  url: string;
}

interface SiteViewerProps {
  site: Site;
  onSiteChange?: (site: Site) => void;
}

const SiteViewer: Component<SiteViewerProps> = (props) => {
  const [isEditing, setIsEditing] = createSignal(!props.site.url);
  const [editName, setEditName] = createSignal(props.site.name);
  const [editUrl, setEditUrl] = createSignal(props.site.url);

  const startEditing = () => {
    setEditName(props.site.name);
    setEditUrl(props.site.url);
    setIsEditing(true);
  };

  const saveEdit = () => {
    props.onSiteChange?.({
      ...props.site,
      name: editName().trim() || 'Untitled',
      url: editUrl().trim(),
    });
    setIsEditing(false);
  };

  return (
    <div class="flex flex-col h-full bg-bg">
      <Show when={isEditing()}>
        <div class="flex flex-col items-center justify-center flex-1 p-8 bg-bg">
          <div class="w-full max-w-md space-y-4">
            <div>
              <label class="block mb-1 text-xs text-fg-muted">Site Name</label>
              <input
                type="text"
                value={editName()}
                onInput={(event) => setEditName(event.currentTarget.value)}
                placeholder="Enter site name..."
                class="w-full input"
                autofocus
              />
            </div>
            <div>
              <label class="block mb-1 text-xs text-fg-muted">URL</label>
              <input
                type="url"
                value={editUrl()}
                onInput={(event) => setEditUrl(event.currentTarget.value)}
                placeholder="https://example.com"
                class="w-full input"
              />
            </div>
            <div class="flex gap-2">
              <button onClick={saveEdit} class="flex-1 btn-primary">
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                class="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={!isEditing() && !props.site.url}>
        <div class="flex flex-col items-center justify-center flex-1 gap-4 p-8 bg-bg">
          <div class="text-xs text-center text-fg-muted">
            No URL configured for this site
          </div>
          <button onClick={startEditing} class="btn-secondary">
            Configure Site
          </button>
        </div>
      </Show>

      <Show when={!isEditing() && props.site.url}>
        <div class="relative flex-1 min-h-0">
          <iframe
            src={props.site.url}
            class="w-full h-full border-0"
            title={props.site.name}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          <button
            onClick={startEditing}
            class="absolute top-2 right-2 px-2 py-1 text-xs border bg-bg border-border hover:bg-bg-subtle transition-colors"
            title="Edit site"
          >
            Edit
          </button>
        </div>
      </Show>
    </div>
  );
};

export default SiteViewer;
