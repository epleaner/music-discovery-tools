import { Component, JSX, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import {
  DockviewComponent,
  type DockviewGroupPanel,
  type GroupPanelPartInitParameters,
  type IContentRenderer,
  type IHeaderActionsRenderer,
  type ITabRenderer,
  type TabPartInitParameters,
} from 'dockview-core';
import {
  buildInitialDockviewPanels,
  createDockviewPanelDescriptor,
  createSiteDockviewPanelDescriptor,
  dockviewPanelTypes,
  type DockviewPanelType,
  type DockviewSiteDefinition,
} from '../lib/dockview-panel-catalog';
import {
  collectDockviewPanelInstanceCounts,
  hasUnsupportedDockviewPanels,
  readInitialDockviewLayout,
  replaceDockviewLayoutHash,
  writeDockviewLayoutToLocalStorage,
} from '../lib/dockview-layout-persistence';

export interface DockviewWorkspaceHandle {
  spawnPanel: (panelType: DockviewPanelType) => void;
}

export interface DockviewWorkspaceProps {
  onCreateSite: () => DockviewSiteDefinition;
  onReady?: (handle: DockviewWorkspaceHandle) => void;
  renderPanel: (
    panelType: DockviewPanelType,
    params: Record<string, unknown>
  ) => JSX.Element;
  sites: DockviewSiteDefinition[];
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

class SoundscapeDockviewHeaderActions implements IHeaderActionsRenderer {
  readonly element = document.createElement('div');
  private readonly button = document.createElement('button');
  private readonly menu = document.createElement('div');

  constructor(
    private readonly addPanel: (
      panelType: DockviewPanelType,
      group?: DockviewGroupPanel,
      site?: DockviewSiteDefinition
    ) => void,
    private readonly group: DockviewGroupPanel,
    private readonly sitesProvider: () => DockviewSiteDefinition[]
  ) {}

  init(): void {
    this.element.className =
      'soundscape-dockview-header-actions relative h-full';

    this.button.type = 'button';
    this.button.className =
      'soundscape-dockview-add-button h-full px-2 text-fg-muted hover:text-fg';
    this.button.textContent = '+';
    this.button.title = 'Add panel';
    this.button.setAttribute('aria-label', 'Add panel');
    this.button.setAttribute('aria-haspopup', 'menu');

    this.menu.className =
      'soundscape-dockview-add-menu absolute right-0 top-full z-50 hidden min-w-36 border border-border bg-bg';
    this.menu.setAttribute('role', 'menu');

    for (const panelType of dockviewPanelTypes) {
      if (panelType.id === 'site') {
        this.menu.append(this.buildSiteMenu());
        continue;
      }

      const item = this.buildMenuItem(panelType.title, () => {
        this.addPanel(panelType.id, this.group);
      });
      this.menu.append(item);
    }

    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleMenu();
    });

    this.element.append(this.button, this.menu);
  }

  dispose(): void {
    this.element.replaceChildren();
  }

  private buildMenuItem(
    label: string,
    onSelect: () => void
  ): HTMLButtonElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'block w-full px-3 py-2 text-left text-xs text-fg-muted hover:text-fg hover:bg-bg-subtle whitespace-nowrap';
    item.textContent = label;
    item.setAttribute('role', 'menuitem');
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      this.hideMenu();
      onSelect();
    });
    return item;
  }

  private buildSiteMenu(): HTMLDivElement {
    const siteMenu = document.createElement('div');
    siteMenu.className = 'relative soundscape-dockview-site-menu';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className =
      'block w-full px-3 py-2 text-left text-xs text-fg-muted hover:text-fg hover:bg-bg-subtle whitespace-nowrap';
    trigger.textContent = 'Site ›';
    trigger.setAttribute('role', 'menuitem');
    trigger.setAttribute('aria-haspopup', 'menu');

    const nestedMenu = document.createElement('div');
    nestedMenu.className =
      'soundscape-dockview-site-submenu absolute left-full top-0 z-50 hidden min-w-44 border border-border bg-bg';
    nestedMenu.setAttribute('role', 'menu');

    for (const site of this.getSites()) {
      nestedMenu.append(
        this.buildMenuItem(site.name, () => {
          this.addPanel('site', this.group, site);
        })
      );
    }

    nestedMenu.append(
      this.buildMenuItem('New Site', () => {
        this.addPanel('site', this.group);
      })
    );

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      nestedMenu.classList.toggle('hidden');
    });

    siteMenu.append(trigger, nestedMenu);
    return siteMenu;
  }

  private toggleMenu(): void {
    this.menu.classList.toggle('hidden');
  }

  private hideMenu(): void {
    this.menu.classList.add('hidden');
    for (const submenu of this.menu.querySelectorAll(
      '.soundscape-dockview-site-submenu'
    )) {
      submenu.classList.add('hidden');
    }
  }

  private getSites(): DockviewSiteDefinition[] {
    return this.sitesProvider();
  }
}

class SolidDockviewPanel implements IContentRenderer {
  readonly element = document.createElement('div');
  private disposeSolid?: () => void;

  constructor(
    private readonly panelType: DockviewPanelType,
    private readonly renderPanel: (
      panelType: DockviewPanelType,
      params: Record<string, unknown>
    ) => JSX.Element
  ) {
    this.element.className = 'h-full min-h-0 overflow-hidden bg-bg text-fg';
  }

  init(parameters: GroupPanelPartInitParameters): void {
    this.disposeSolid = render(
      () => this.renderPanel(this.panelType, parameters.params ?? {}),
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

  const createPanel = (
    panelType: DockviewPanelType,
    site?: DockviewSiteDefinition
  ) => {
    if (panelType === 'site') {
      const selectedSite = site ?? props.onCreateSite();
      return createSiteDockviewPanelDescriptor(
        selectedSite,
        nextInstanceNumber(panelType)
      );
    }

    return createDockviewPanelDescriptor(
      panelType,
      nextInstanceNumber(panelType)
    );
  };

  const addInitialPanels = () => {
    for (const panel of buildInitialDockviewPanels(props.sites)) {
      instanceCounts.set(
        panel.component,
        Math.max(instanceCounts.get(panel.component) ?? 0, 1)
      );
      dockview?.addPanel(panel);
    }
  };

  const saveLayout = () => {
    if (!dockview) return;

    const layout = dockview.toJSON();
    replaceDockviewLayoutHash(layout);
    writeDockviewLayoutToLocalStorage(layout);
  };

  const addPanel = (
    panelType: DockviewPanelType,
    group?: DockviewGroupPanel,
    site?: DockviewSiteDefinition
  ) => {
    const panel = createPanel(panelType, site);
    dockview?.addPanel({
      ...panel,
      ...(group ? { position: { referenceGroup: group } } : {}),
    });
    saveLayout();
  };

  onMount(() => {
    if (!containerRef) return;

    dockview = new DockviewComponent(containerRef, {
      createComponent: (options) =>
        new SolidDockviewPanel(
          options.name as DockviewPanelType,
          props.renderPanel
        ),
      createRightHeaderActionComponent: (group) =>
        new SoundscapeDockviewHeaderActions(addPanel, group, () => props.sites),
      createTabComponent: () => new SoundscapeDockviewTab(),
    });

    const persistedLayout = readInitialDockviewLayout();
    if (persistedLayout && !hasUnsupportedDockviewPanels(persistedLayout)) {
      try {
        dockview.fromJSON(
          persistedLayout as unknown as ReturnType<DockviewComponent['toJSON']>
        );
        for (const [panelType, count] of collectDockviewPanelInstanceCounts(
          persistedLayout
        )) {
          instanceCounts.set(panelType, count);
        }
        replaceDockviewLayoutHash(persistedLayout);
      } catch {
        addInitialPanels();
        saveLayout();
      }
    } else {
      addInitialPanels();
      saveLayout();
    }

    const layoutDisposable = dockview.onDidLayoutChange(saveLayout);

    props.onReady?.({ spawnPanel: addPanel });

    onCleanup(() => {
      layoutDisposable.dispose();
    });
  });

  onCleanup(() => {
    dockview?.dispose();
    props.onReady?.({ spawnPanel: () => undefined });
  });

  return (
    <div class="flex flex-col flex-1 min-h-0 bg-bg">
      <div
        ref={containerRef}
        class="soundscape-dockview dockview-theme-light flex-1 min-h-0"
      />
    </div>
  );
};

export default DockviewWorkspace;
