import {
  Component,
  For,
  createEffect,
  createMemo,
  createResource,
  Show,
  createSignal,
  onCleanup,
  onMount,
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
import ShuffleIcon from './ShuffleIcon';

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
  const [contentRef, setContentRef] = createSignal<HTMLDivElement | null>(null);
  let inputRef!: HTMLInputElement;
  let timerRef: NodeJS.Timeout;

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

  const virtualizer = createVirtualizer({
    get count() {
      return virtualItems().length;
    },
    get enabled() {
      return contentRef() !== null;
    },
    getScrollElement: contentRef,
    estimateSize: (index) => {
      const item = virtualItems()[index];
      if (item?.type === 'group') return 32;
      const genre = item?.item;
      return genre?.path !== genre?.label ? 144 : 112;
    },
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const handleInputChange = (details: { inputValue: string }) => {
    setInputValue(details.inputValue);
    filter(details.inputValue);
  };

  const handleRemovePill = (valueToRemove: string) => {
    const currentValues = props.value || [];
    props.onValueChange(currentValues.filter((v) => v !== valueToRemove));
    inputRef?.focus();
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
    let itemIndex = -1;
    const virtualIndex = virtualItems().findIndex((item) => {
      if (item.type !== 'item') return false;
      itemIndex += 1;
      return itemIndex === details.index;
    });
    if (virtualIndex < 0) return;
    const scrollOptions: ScrollToOptions = {
      align: 'center',
      behavior: 'auto',
    };
    if (details.immediate) {
      virtualizer.scrollToIndex(virtualIndex, scrollOptions);
    } else {
      clearTimeout(timerRef);
      timerRef = setTimeout(() => {
        virtualizer.scrollToIndex(virtualIndex, scrollOptions);
      });
    }
  };

  onCleanup(() => clearTimeout(timerRef));

  return (
    <Combobox.Root
      collection={collection()}
      value={props.value || []}
      multiple
      onValueChange={(details) => {
        props.onValueChange(details.value);
        setInputValue('');
        filter('');
      }}
      inputValue={inputValue()}
      onInputValueChange={handleInputChange}
      scrollToIndexFn={handleScrollToIndexFn}
      positioning={{ sameWidth: true }}
    >
      <ControlGroup>
        <div class="toolbar">
          <Combobox.Label class="field-label">Genre</Combobox.Label>
          <Button
            type="button"
            onClick={handleShuffle}
            variant="icon"
            aria-label="Shuffle genres"
            title="Shuffle genres"
          >
            <ShuffleIcon />
          </Button>
        </div>
        <Combobox.Control class="combobox-control">
          <div class="toolbar min-w-0 flex-1">
            <For each={selectedItems()}>
              {(item) => (
                <Chip variant="subtle" class="max-w-full">
                  <span class="min-w-0 break-words">{item.label}</span>
                  <Button
                    type="button"
                    variant="control"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleRemovePill(item.value);
                    }}
                    aria-label={`Remove ${item.label}`}
                  >
                    ×
                  </Button>
                </Chip>
              )}
            </For>
            <Combobox.Input
              ref={inputRef}
              placeholder={props.value.length === 0 ? 'Search genres' : ''}
              class={`${inputClassName} min-w-0 w-full`}
              onKeyDown={handleInputKeyDown}
            />
          </div>
          <Combobox.Trigger class="btn control-icon" aria-label="Show genres">
            +
          </Combobox.Trigger>
          <Combobox.ClearTrigger
            class="btn control-icon"
            aria-label="Clear genres"
            onClick={() => {
              props.onValueChange([]);
              setInputValue('');
              filter('');
            }}
          >
            ×
          </Combobox.ClearTrigger>
        </Combobox.Control>
      </ControlGroup>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content ref={setContentRef} class="combobox-content">
            <div
              class="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              <For each={virtualizer.getVirtualItems()}>
                {(virtualItem) => {
                  const flatItem = () => virtualItems()[virtualItem.index];
                  return (
                    <Show
                      when={flatItem()?.type === 'group'}
                      fallback={
                        <Show when={flatItem()?.item} keyed>
                          {(item) => (
                            <Combobox.Item
                              item={item}
                              ref={(element) =>
                                onMount(() =>
                                  virtualizer.measureElement(element)
                                )
                              }
                              data-index={virtualItem.index}
                              style={{
                                transform: `translateY(${virtualItem.start}px)`,
                              }}
                              class="combobox-option absolute left-0 top-0 w-full"
                            >
                              <Combobox.ItemText class="control-group min-w-0 break-words">
                                <span class="result-title">{item.label}</span>
                                <span class="meta-text">
                                  {item.description}
                                </span>
                                <Show when={item.path !== item.label}>
                                  <span class="subtle-text">{item.path}</span>
                                </Show>
                              </Combobox.ItemText>
                              <Show when={props.value.includes(item.value)}>
                                <span class="text-accent" aria-hidden="true">
                                  ✓
                                </span>
                              </Show>
                            </Combobox.Item>
                          )}
                        </Show>
                      }
                    >
                      <div
                        ref={(element) =>
                          onMount(() => virtualizer.measureElement(element))
                        }
                        data-index={virtualItem.index}
                        style={{
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                        class="combobox-group absolute left-0 top-0 w-full"
                      >
                        {flatItem()?.groupLabel}
                      </div>
                    </Show>
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
