import { Component, JSX, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import {
  DockviewComponent,
  type IContentRenderer,
  type ITabRenderer,
  type GroupPanelPartInitParameters,
  type TabPartInitParameters,
} from 'dockview-core';
import {
  buildInitialDockviewPanels,
  createDockviewPanelDescriptor,
  dockviewPanelTypes,
  type DockviewPanelType,
} from '../lib/dockview-panel-catalog';

export interface DockviewWorkspaceHandle {
  spawnPanel: (panelType: DockviewPanelType) => void;
}

export interface DockviewWorkspaceProps {
  onReady?: (handle: DockviewWorkspaceHandle) => void;
  renderPanel: (panelType: DockviewPanelType) => JSX.Element;
}

class SoundscapeDockviewTab implements ITabRenderer {
  readonly element = document.createElement('div');

  init(parameters: TabPartInitParameters): void {
    this.element.className =
      'soundscape-dockview-tab flex items-center gap-2 h-full min-w-0';
    this.element.innerHTML = '';

    const title = document.createElement('span');
    title.className = 'truncate';
    title.textContent = parameters.title;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className =
      'soundscape-dockview-tab-close flex-shrink-0 text-fg-muted hover:text-fg';
    closeButton.setAttribute('aria-label', `Close ${parameters.title}`);
    closeButton.title = 'Close panel';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      parameters.api.close();
    });

    this.element.append(title, closeButton);
  }

  layout(): void {
    // Tab content is sized by Dockview.
  }

  update(): void {
    // Titles are static for Soundscape panels.
  }

  dispose(): void {
    this.element.replaceChildren();
  }
}

class SolidDockviewPanel implements IContentRenderer {
  readonly element = document.createElement('div');
  private disposeSolid?: () => void;

  constructor(
    private readonly panelType: DockviewPanelType,
    private readonly renderPanel: (panelType: DockviewPanelType) => JSX.Element
  ) {
    this.element.className = 'h-full min-h-0 overflow-hidden bg-bg text-fg';
  }

  init(_parameters: GroupPanelPartInitParameters): void {
    this.disposeSolid = render(
      () => this.renderPanel(this.panelType),
      this.element
    );
  }

  layout(): void {
    // Solid content fills the container with CSS; Dockview owns sizing.
  }

  update(): void {
    // Panel titles and params are static for now.
  }

  dispose(): void {
    this.disposeSolid?.();
  }
}

const DockviewWorkspace: Component<DockviewWorkspaceProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let dockview: DockviewComponent | undefined;
  const instanceCounts = new Map<DockviewPanelType, number>();

  const nextInstanceNumber = (panelType: DockviewPanelType) => {
    const next = (instanceCounts.get(panelType) ?? 0) + 1;
    instanceCounts.set(panelType, next);
    return next;
  };

  const addPanel = (panelType: DockviewPanelType) => {
    const panel = createDockviewPanelDescriptor(
      panelType,
      nextInstanceNumber(panelType)
    );
    dockview?.addPanel(panel);
  };

  onMount(() => {
    if (!containerRef) return;

    dockview = new DockviewComponent(containerRef, {
      createComponent: (options) =>
        new SolidDockviewPanel(
          options.name as DockviewPanelType,
          props.renderPanel
        ),
      createTabComponent: () => new SoundscapeDockviewTab(),
    });

    for (const panel of buildInitialDockviewPanels()) {
      instanceCounts.set(panel.component, 1);
      dockview.addPanel(panel);
    }

    props.onReady?.({ spawnPanel: addPanel });
  });

  onCleanup(() => {
    dockview?.dispose();
    props.onReady?.({ spawnPanel: () => undefined });
  });

  return (
    <div class="flex flex-col flex-1 min-h-0 bg-bg">
      <div class="flex flex-shrink-0 gap-1 p-2 border-b bg-bg border-border overflow-x-auto">
        <span class="px-2 py-1 text-xs text-fg-muted whitespace-nowrap">
          Add panel
        </span>
        {dockviewPanelTypes.map((panelType) => (
          <button
            type="button"
            onClick={() => addPanel(panelType.id)}
            class="px-2 py-1 text-xs whitespace-nowrap text-fg-muted hover:text-fg"
            title={`Open another ${panelType.title} panel`}
          >
            {panelType.title}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        class="soundscape-dockview dockview-theme-light flex-1 min-h-0"
      />
    </div>
  );
};

export default DockviewWorkspace;
