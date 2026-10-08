import { splitProps, type Component, type JSX } from 'solid-js';

export type ChipVariant = 'muted' | 'subtle';

export interface ChipProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

const variantClassName: Record<ChipVariant, string> = {
  muted: '',
  subtle: 'badge-subtle',
};

const Chip: Component<ChipProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class']);

  return (
    <span
      {...rest}
      class={`badge ${
        variantClassName[local.variant ?? 'muted']
      } ${local.class ?? ''}`}
    />
  );
};
export default Chip;
