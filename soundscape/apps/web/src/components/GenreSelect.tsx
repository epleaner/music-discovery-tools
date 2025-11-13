import { Component, For, createMemo, Show } from 'solid-js';
import { Combobox, useListCollection } from '@ark-ui/solid/combobox';
import { useFilter } from '@ark-ui/solid/locale';
import { Portal } from 'solid-js/web';
import {
  type ScrollToOptions,
  createVirtualizer,
} from '@tanstack/solid-virtual';
import {
  loadFlattenedGenres,
  type FlattenedGenre,
} from '../lib/flatten-genres';

interface GenreSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

interface GenreItem {
  label: string;
  value: string;
  description: string;
  path: string;
  type: string;
}

interface ScrollToIndexDetails {
  index: number;
  immediate?: boolean;
}

interface VirtualItem {
  type: 'group' | 'item';
  groupLabel?: string;
  item?: GenreItem;
  index: number;
}

const GenreSelect: Component<GenreSelectProps> = (props) => {
  // oxlint-disable-next-line no-unassigned-vars
  let contentRef!: HTMLDivElement;
  let timerRef: NodeJS.Timeout;

  const filterFn = useFilter({ sensitivity: 'base' });

  // Transform flattened genres to include type (top-level genre) for grouping
  const initialItems = createMemo(() => {
    const flattened = loadFlattenedGenres();
    return flattened.map((genre: FlattenedGenre): GenreItem => {
      // Extract top-level genre from path (first part before ">")
      const topLevel = genre.path.split(' > ')[0];
      return {
        label: genre.name,
        value: genre.name,
        description: genre.description,
        path: genre.path,
        type: topLevel,
      };
    });
  });

  const { collection, filter } = useListCollection({
    initialItems: initialItems(),
    filter: filterFn().contains,
    groupBy: (item) => item.type,
  });

  // Create a flattened list for virtualization that includes group labels and items
  const virtualItems = createMemo(() => {
    const groups = collection().group();
    const flat: VirtualItem[] = [];
    let globalIndex = 0;

    for (const [type, group] of groups) {
      // Add group label
      flat.push({
        type: 'group',
        groupLabel: type,
        index: globalIndex++,
      });
      // Add items in group
      for (const item of group) {
        flat.push({
          type: 'item',
          item,
          index: globalIndex++,
        });
      }
    }
    return flat;
  });

  // Calculate item height based on content (label, description, optional path)
  const calculateItemHeight = (item: GenreItem | undefined): number => {
    if (!item) return 64; // Default fallback

    // Base padding: py-2 = 8px top + 8px bottom = 16px
    let height = 16;

    // Label: text-xs (14px) with line-height ~1.5 = ~21px per line
    // Assuming ~400px width, ~50 chars per line for text-xs
    const labelLines = Math.ceil(item.label.length / 50);
    height += labelLines * 21;

    // Gap between label and description: gap-0.5 = 2px
    height += 2;

    // Description: text-[11px] with line-height ~1.5 = ~16.5px per line
    // ~60 chars per line for text-[11px]
    const descLines = Math.ceil(item.description.length / 60);
    height += descLines * 16.5;

    // Path (if exists): text-[10px] with line-height ~1.5 = ~15px per line
    // ~65 chars per line for text-[10px]
    if (item.path !== item.label) {
      height += 2; // Gap between description and path
      const pathLines = Math.ceil(item.path.length / 65);
      height += pathLines * 15;
    }

    return Math.max(height, 48); // Minimum height
  };

  // Create virtualizer reactively - recreates when items change
  const virtualizer = createMemo(() => {
    const items = virtualItems();
    return createVirtualizer({
      count: items.length,
      getScrollElement: () => contentRef,
      estimateSize: (index) => {
        const item = items[index];
        if (item?.type === 'group') {
          return 32; // Group labels are fixed height
        }
        return calculateItemHeight(item?.item);
      },
    });
  });

  const handleInputChange = (details: { inputValue: string }) => {
    filter(details.inputValue);
  };

  const handleScrollToIndexFn = (details: ScrollToIndexDetails) => {
    const scrollOptions: ScrollToOptions = {
      align: 'center',
      behavior: 'auto',
    };
    if (details.immediate) {
      virtualizer().scrollToIndex(details.index, scrollOptions);
    } else {
      clearTimeout(timerRef);
      timerRef = setTimeout(() => {
        virtualizer().scrollToIndex(details.index, scrollOptions);
      });
    }
  };

  return (
    <Combobox.Root
      collection={collection()}
      value={props.value ? [props.value] : []}
      onValueChange={(details) => {
        if (details.value && details.value.length > 0) {
          props.onValueChange(details.value[0]);
        }
      }}
      onInputValueChange={handleInputChange}
      scrollToIndexFn={handleScrollToIndexFn}
      positioning={{ sameWidth: true }}
    >
      <Combobox.Label class="block mb-1 text-xs text-fg-muted">
        Genre
      </Combobox.Label>
      <Combobox.Control class="relative flex items-center ">
        <Combobox.Trigger class="w-full">
          <Combobox.Input
            placeholder="Search genre..."
            class="w-full text-xs input px-2 py-1.5 border border-border bg-bg relative"
          />
        </Combobox.Trigger>
        <Combobox.ClearTrigger class="absolute right-0 text-fg-muted hover:text-fg px-2">
          🅧
        </Combobox.ClearTrigger>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content
            ref={contentRef}
            class="bg-bg border border-border shadow-lg"
            style={{
              height: '384px',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                height: `${virtualizer().getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <For each={virtualizer().getVirtualItems()}>
                {(virtualItem) => {
                  const items = virtualItems();
                  const flatItem = items[virtualItem.index];
                  if (!flatItem) return null;

                  if (flatItem.type === 'group') {
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                        class="px-3 py-2 text-xs font-medium text-fg-muted bg-bg-subtle border-b border-border sticky top-0 z-10"
                      >
                        {flatItem.groupLabel}
                      </div>
                    );
                  }

                  if (!flatItem.item) return null;

                  return (
                    <Combobox.Item
                      item={flatItem.item}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      class="px-3 py-2 text-xs hover:bg-bg-subtle cursor-pointer border-b border-border flex items-center"
                    >
                      <Combobox.ItemText class="flex flex-col gap-0.5 flex-1">
                        <span class="text-fg font-medium">
                          {flatItem.item.label}
                        </span>
                        <span class="text-fg-muted text-[11px]">
                          {flatItem.item.description}
                        </span>
                        <Show when={flatItem.item.path !== flatItem.item.label}>
                          <span class="text-fg-subtle text-[10px]">
                            {flatItem.item.path}
                          </span>
                        </Show>
                      </Combobox.ItemText>
                      <Combobox.ItemIndicator class="text-fg ml-2">
                        ✓
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  );
                }}
              </For>
            </div>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};

export default GenreSelect;
