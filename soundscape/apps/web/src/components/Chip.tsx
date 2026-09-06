import { splitProps, type Component, type JSX } from 'solid-js';

export type ChipVariant = 'muted' | 'subtle';

export interface ChipProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClassName: Record<ChipVariant, string> = {
  muted: 'bg-bg-muted text-fg-subtle',
  subtle: 'bg-bg-subtle text-fg-muted',
};

const Chip: Component<ChipProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class']);

  return (
    <span
      {...rest}
      class={`control-size inline-flex items-center rounded px-1.5 ${
        variantClassName[local.variant ?? 'muted']
      } ${local.class ?? ''}`}
    />
  );
};
export default Chip;
