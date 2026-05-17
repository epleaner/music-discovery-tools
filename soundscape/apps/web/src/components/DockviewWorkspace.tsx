import {
  Component,
  JSX,
  Show,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
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
import {
  positionDropdownContent,
  positionDropdownSubContent,
} from '../lib/dropdown-position';
import {
  getDockviewEmptyStateOverlayClass,
  shouldHandleDockviewEmptyStateClick,
  shouldShowDockviewEmptyState,
} from '../lib/dockview-empty-state';
import { Button } from './ui/Button';

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
  private readonly siteSubmenu = document.createElement('div');

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
    this.element.className = 'soundscape-dockview-header-actions h-full';

    this.button.type = 'button';
    this.button.className =
      'soundscape-dockview-add-button h-full px-2 text-fg-muted hover:text-fg';
    this.button.textContent = '+';
    this.button.title = 'Add panel';
    this.button.setAttribute('aria-label', 'Add panel');
    this.button.setAttribute('aria-haspopup', 'menu');

    this.menu.className =
      'soundscape-dockview-menu-content hidden fixed z-50 min-w-36 overflow-visible border border-border bg-bg p-1 text-fg';
    this.menu.setAttribute('role', 'menu');

    this.siteSubmenu.className =
      'soundscape-dockview-menu-content soundscape-dockview-site-submenu hidden fixed z-50 min-w-44 overflow-visible border border-border bg-bg p-1 text-fg';
    this.siteSubmenu.setAttribute('role', 'menu');

    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleMenu();
    });

    document.addEventListener('click', this.handleDocumentClick);
    document.body.append(this.menu, this.siteSubmenu);
    this.element.append(this.button);
  }

  dispose(): void {
    document.removeEventListener('click', this.handleDocumentClick);
    this.menu.remove();
    this.siteSubmenu.remove();
    this.element.replaceChildren();
  }

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (
      !this.element.contains(target) &&
      !this.menu.contains(target) &&
      !this.siteSubmenu.contains(target)
    ) {
      this.hideMenu();
    }
  };

  private buildMenuItem(
    label: string,
    onSelect: () => void
  ): HTMLButtonElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'soundscape-dockview-menu-item flex w-full items-center px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-bg-subtle hover:text-fg whitespace-nowrap';
    item.textContent = label;
    item.setAttribute('role', 'menuitem');
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      this.hideMenu();
      onSelect();
    });
    return item;
  }

  private buildSiteMenuTrigger(): HTMLButtonElement {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className =
      'soundscape-dockview-menu-item flex w-full items-center px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-bg-subtle hover:text-fg whitespace-nowrap';
    trigger.textContent = 'Site';
    trigger.setAttribute('role', 'menuitem');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleSiteSubmenu(trigger);
    });
    return trigger;
  }

  private renderMenu(): void {
    this.menu.replaceChildren();

    for (const panelType of dockviewPanelTypes) {
      if (panelType.id === 'site') {
        this.menu.append(this.buildSiteMenuTrigger());
        continue;
      }

      this.menu.append(
        this.buildMenuItem(panelType.title, () => {
          this.addPanel(panelType.id, this.group);
        })
      );
    }
  }

  private renderSiteSubmenu(): void {
    this.siteSubmenu.replaceChildren();

    for (const site of this.getSites()) {
      this.siteSubmenu.append(
        this.buildMenuItem(site.name, () => {
          this.addPanel('site', this.group, site);
        })
      );
    }

    this.siteSubmenu.append(
      this.buildMenuItem('+ New Site', () => {
        this.addPanel('site', this.group);
      })
    );
  }

  private toggleMenu(): void {
    if (this.menu.classList.contains('hidden')) {
      this.showMenu();
    } else {
      this.hideMenu();
    }
  }

  private showMenu(): void {
    this.renderMenu();
    this.menu.classList.remove('hidden');
    const position = positionDropdownContent(
      this.button.getBoundingClientRect(),
      { width: this.menu.offsetWidth }
    );
    this.menu.style.left = `${position.left}px`;
    this.menu.style.top = `${position.top}px`;
  }

  private toggleSiteSubmenu(trigger: HTMLElement): void {
    if (this.siteSubmenu.classList.contains('hidden')) {
      this.showSiteSubmenu(trigger);
    } else {
      this.siteSubmenu.classList.add('hidden');
    }
  }

  private showSiteSubmenu(trigger: HTMLElement): void {
    this.renderSiteSubmenu();
    this.siteSubmenu.classList.remove('hidden');
    const position = positionDropdownSubContent(
      trigger.getBoundingClientRect(),
      { width: this.siteSubmenu.offsetWidth }
    );
    this.siteSubmenu.style.left = `${position.left}px`;
    this.siteSubmenu.style.top = `${position.top}px`;
  }

  private hideMenu(): void {
    this.menu.classList.add('hidden');
    this.siteSubmenu.classList.add('hidden');
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
  let lastEmptyStatePointerSpawnAt: number | undefined;
  const [showEmptyState, setShowEmptyState] = createSignal(false);
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

  const updateEmptyState = () => {
    setShowEmptyState(shouldShowDockviewEmptyState(dockview?.totalPanels ?? 0));
  };

  const saveLayout = () => {
    if (!dockview) return;

    updateEmptyState();
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

  const spawnEmptyStatePanel = () => {
    addPanel('library');
  };

  const handleEmptyStatePointerDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    lastEmptyStatePointerSpawnAt = performance.now();
    spawnEmptyStatePanel();
  };

  const handleEmptyStateClick = () => {
    const now = performance.now();
    if (
      !shouldHandleDockviewEmptyStateClick(lastEmptyStatePointerSpawnAt, now)
    ) {
      return;
    }

    spawnEmptyStatePanel();
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

    updateEmptyState();
    const layoutDisposable = dockview.onDidLayoutChange(saveLayout);
    const addDisposable = dockview.onDidAddPanel(updateEmptyState);
    const removeDisposable = dockview.onDidRemovePanel(updateEmptyState);

    props.onReady?.({ spawnPanel: addPanel });

    onCleanup(() => {
      layoutDisposable.dispose();
      addDisposable.dispose();
      removeDisposable.dispose();
    });
  });

  onCleanup(() => {
    dockview?.dispose();
    props.onReady?.({ spawnPanel: () => undefined });
  });

  return (
    <div class="relative flex flex-col flex-1 min-h-0 bg-bg">
      <div
        ref={containerRef}
        class="soundscape-dockview dockview-theme-light flex-1 min-h-0"
      />
      <Show when={showEmptyState()}>
        <div class={getDockviewEmptyStateOverlayClass()}>
          <Button
            type="button"
            onPointerDown={handleEmptyStatePointerDown}
            onClick={handleEmptyStateClick}
          >
            + New Panel
          </Button>
        </div>
      </Show>
    </div>
  );
};

export default DockviewWorkspace;
