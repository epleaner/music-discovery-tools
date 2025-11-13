import { Component, For, createMemo, Show } from 'solid-js';
import { Combobox, useListCollection } from '@ark-ui/solid/combobox';
import { useFilter } from '@ark-ui/solid/locale';
import { Portal } from 'solid-js/web';
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

const GenreSelect: Component<GenreSelectProps> = (props) => {
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

  const handleInputChange = (details: { inputValue: string }) => {
    filter(details.inputValue);
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
            class="bg-bg border border-border shadow-lg"
            style={{
              height: '384px',
              overflow: 'auto',
            }}
          >
            <For each={collection().group()}>
              {([type, group]) => (
                <Combobox.ItemGroup>
                  <Combobox.ItemGroupLabel class="px-3 py-2 text-xs font-medium text-fg-muted bg-bg-subtle border-b border-border sticky top-0">
                    {type}
                  </Combobox.ItemGroupLabel>
                  <For each={group}>
                    {(item) => (
                      <Combobox.Item
                        item={item}
                        class="px-3 py-2 text-xs hover:bg-bg-subtle cursor-pointer border-b border-border last:border-b-0 flex items-center"
                      >
                        <Combobox.ItemText class="flex flex-col gap-0.5 flex-1">
                          <span class="text-fg font-medium">{item.label}</span>
                          <span class="text-fg-muted text-[11px]">
                            {item.description}
                          </span>
                          <Show when={item.path !== item.label}>
                            <span class="text-fg-subtle text-[10px]">
                              {item.path}
                            </span>
                          </Show>
                        </Combobox.ItemText>
                        <Combobox.ItemIndicator class="text-fg ml-2">
                          ✓
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </For>
                </Combobox.ItemGroup>
              )}
            </For>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};

export default GenreSelect;
