import {
  Component,
  For,
  createEffect,
  createMemo,
  createResource,
  Show,
  createSignal,
} from 'solid-js';
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
import Button from './Button';
import Chip from './Chip';
import ControlGroup from './ControlGroup';
import { inputClassName } from './Input';

interface GenreSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
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
  // oxlint-disable-next-line no-unassigned-vars
  let pillsContainerRef!: HTMLDivElement;
  let timerRef: NodeJS.Timeout;
  // oxlint-disable-next-line no-unassigned-vars
  let triggerRef!: HTMLButtonElement;

  const [inputValue, setInputValue] = createSignal('');
  const filterFn = useFilter({ sensitivity: 'base' });

  const [flattenedGenres] = createResource(loadFlattenedGenres);
  const initialItems = createMemo(() => {
    const flattened = flattenedGenres() ?? [];
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

  const { collection, filter, set } = useListCollection({
    initialItems: initialItems(),
    filter: filterFn().contains,
    groupBy: (item) => item.type,
  });

  createEffect(() => {
    set(initialItems());
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
    setInputValue(details.inputValue);
    filter(details.inputValue);
  };

  const handleItemSelect = (item: GenreItem) => {
    const currentValues = props.value || [];
    if (!currentValues.includes(item.value)) {
      props.onValueChange([...currentValues, item.value]);
    }
    // Focus back on input
    setTimeout(() => {
      setInputValue('');
      filter('');
      triggerRef?.click();
    }, 0);
  };

  const handleRemovePill = (valueToRemove: string) => {
    const currentValues = props.value || [];
    props.onValueChange(currentValues.filter((v) => v !== valueToRemove));
    // Focus back on input
    setTimeout(() => {
      triggerRef?.click();
    }, 0);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    // Remove last pill on backspace when input is empty
    if (
      e.key === 'Backspace' &&
      inputValue() === '' &&
      props.value.length > 0
    ) {
      e.preventDefault();
      const currentValues = props.value || [];
      props.onValueChange(currentValues.slice(0, -1));
    }
  };

  // Get selected items for display
  const selectedItems = createMemo(() => {
    const allItems = initialItems();
    const selected = props.value
      .map((val) => allItems.find((item) => item.value === val))
      .filter((item): item is GenreItem => item !== undefined);
    return selected;
  });

  const handleShuffle = () => {
    const allItems = initialItems();
    if (allItems.length === 0) return;

    // Randomly pick between 1-3 genres
    const count = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
    const shuffled = [...allItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((item) => item.value);

    props.onValueChange(shuffled);
    setTimeout(() => {
      setInputValue('');
      filter('');
    }, 0);
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
      value={props.value || []}
      onValueChange={() => {
        // Don't update from combobox value changes - we handle selection manually
      }}
      inputValue={inputValue()}
      onInputValueChange={handleInputChange}
      scrollToIndexFn={handleScrollToIndexFn}
      positioning={{ sameWidth: true }}
    >
      <ControlGroup>
        <div class="flex items-center gap-1">
          <Combobox.Label class="block text-xs text-fg-muted">
            Genre
          </Combobox.Label>
          <Button
            type="button"
            onClick={handleShuffle}
            variant="icon"
            class="text-fg-muted hover:text-fg"
            title="Shuffle genres"
          >
            ↻
          </Button>
        </div>
        <Combobox.Control class="relative flex items-center min-h-6">
          <div
            ref={pillsContainerRef}
            class="flex flex-wrap items-center gap-1 flex-1 control-surface ring-1 ring-inset ring-border"
            onClick={() => {
              triggerRef?.click();
            }}
          >
            <For each={selectedItems()}>
              {(item) => (
                <Chip variant="subtle" class="gap-1 px-2 border border-border">
                  <span class="text-fg">{item.label}</span>
                  <Button
                    type="button"
                    variant="control"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleRemovePill(item.value);
                    }}
                    class="px-1 text-fg-muted hover:text-fg ml-1"
                    aria-label={`Remove ${item.label}`}
                  >
                    ×
                  </Button>
                </Chip>
              )}
            </For>
            <Combobox.Trigger
              class="control-size flex-1 min-w-[120px] p-0 m-0 flex items-center"
              ref={triggerRef}
            >
              <Combobox.Input
                placeholder={props.value.length === 0 ? 'Search genre...' : ''}
                class={`${inputClassName} w-full flex-1 bg-transparent border-0 outline-none min-w-[120px] p-0 m-0`}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  triggerRef?.click();
                }}
              />
            </Combobox.Trigger>
          </div>
          <Combobox.ClearTrigger
            class="control-size absolute right-0 text-fg-muted hover:text-fg px-2"
            onClick={() => {
              props.onValueChange([]);
              setInputValue('');
              filter('');
            }}
          >
            🅧
          </Combobox.ClearTrigger>
        </Combobox.Control>
      </ControlGroup>
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

                  const isSelected = () =>
                    props.value.includes(flatItem.item!.value);

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
                      onClick={() => handleItemSelect(flatItem.item!)}
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
                      <Show when={isSelected()}>
                        <span class="text-fg ml-2">✓</span>
                      </Show>
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
